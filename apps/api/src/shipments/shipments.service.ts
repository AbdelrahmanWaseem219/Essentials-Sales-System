import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeService } from '../common/realtime/realtime.service';
import { BostaClient } from '../integrations/bosta/bosta.client';
import { mapBostaState } from '../integrations/bosta/bosta.mapper';
import { ShopifyService } from '../integrations/shopify/shopify.service';
import { OdooService } from '../integrations/odoo/odoo.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderWorkflowService } from '../orders/workflow/order-workflow.service';

@Injectable()
export class ShipmentsService {
  private readonly logger = new Logger(ShipmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bosta: BostaClient,
    private readonly workflow: OrderWorkflowService,
    private readonly notifications: NotificationsService,
    private readonly shopify: ShopifyService,
    private readonly odoo: OdooService,
    private readonly realtime: RealtimeService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Poll Odoo for orders whose final Delivery transfer has been validated
   * ('done') and auto-create the Bosta shipment. Driven by OdooDeliveryPoller.
   * This is what turns "warehouse validates the Delivery in Odoo" into a real
   * Bosta shipment with a tracking number.
   */
  async syncValidatedDeliveries() {
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PROCESSING,
        odooPickingId: { not: null },
        shipments: { none: {} },
        shipmentClaimedAt: null, // don't race a shipment already being created
      },
      select: { id: true, odooPickingId: true, orderNumber: true, shippingAddressId: true },
    });
    for (const o of orders) {
      const state = await this.odoo.getPickingState(o.odooPickingId!).catch(() => null);
      if (state !== 'done') continue;

      // Can't ship without an address — put the order ON_HOLD (with a reason) so
      // it's surfaced to an agent and stops being polled forever (no log spam).
      if (!o.shippingAddressId) {
        this.logger.warn(`${o.orderNumber}: delivery validated but no shipping address → ON_HOLD`);
        await this.workflow
          .transition(
            o.id,
            OrderStatus.ON_HOLD,
            { message: 'Cannot create Bosta shipment: order has no shipping address' },
            { holdReason: 'Missing shipping address' },
          )
          .catch(() => undefined);
        continue;
      }

      this.logger.log(`Odoo delivery validated for ${o.orderNumber} → creating Bosta shipment`);
      await this.createForOrder(o.id).catch((e) =>
        this.logger.error(`Auto-ship ${o.orderNumber} failed: ${e.message}`),
      );
    }
  }

  /** Create a Bosta shipment for an order, then mark the order SHIPPED.
   *  actorId is optional (omitted for system/automation-triggered shipments). */
  async createForOrder(orderId: string, actorId?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, shippingAddress: true, shipments: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PROCESSING) {
      throw new BadRequestException(`Order must be PROCESSING to ship (is ${order.status})`);
    }
    if (order.shipments.length) {
      throw new BadRequestException('Order already has a shipment');
    }
    if (!order.shippingAddress) throw new BadRequestException('Order has no shipping address');

    // Atomically CLAIM shipment creation so the manual button and the Odoo poller
    // can't both create a Bosta label for the same order. A single conditional
    // UPDATE is atomic — only one concurrent caller gets count === 1.
    const claim = await this.prisma.order.updateMany({
      where: { id: order.id, shipmentClaimedAt: null },
      data: { shipmentClaimedAt: new Date() },
    });
    if (claim.count === 0) {
      throw new BadRequestException('A shipment is already being created for this order');
    }

    // COD amount: collect the balance still owed (0 if already fully paid online).
    const owed = await this.outstandingAmount(order.id, Number(order.grandTotal));

    let delivery;
    try {
      delivery = await this.bosta.createDelivery({
        type: 10,
        cod: owed,
        businessReference: order.orderNumber,
        notes: order.customerNote ?? undefined,
        receiver: {
          firstName: order.shippingAddress.firstName ?? order.customer.firstName ?? 'Customer',
          lastName: order.shippingAddress.lastName ?? order.customer.lastName ?? '',
          phone: order.shippingAddress.phone ?? order.customer.phone ?? '',
          email: order.customer.email ?? undefined,
        },
        dropOffAddress: {
          city: order.shippingAddress.city,
          zone: order.shippingAddress.district ?? undefined,
          firstLine: order.shippingAddress.line1,
          secondLine: order.shippingAddress.line2 ?? undefined,
        },
      });
    } catch (e) {
      // Release the claim so this order can be retried (no label was created).
      await this.prisma.order
        .update({ where: { id: order.id }, data: { shipmentClaimedAt: null } })
        .catch(() => undefined);
      throw e;
    }

    const trackingUrl = `https://bosta.co/tracking-shipments?id=${delivery.trackingNumber}`;
    const shipment = await this.prisma.shipment.create({
      data: {
        orderId: order.id,
        courier: 'BOSTA',
        status: ShipmentStatus.CREATED,
        trackingNumber: delivery.trackingNumber,
        bostaDeliveryId: delivery._id,
        trackingUrl,
        events: {
          create: {
            status: ShipmentStatus.CREATED,
            description: 'Shipment created with Bosta',
            occurredAt: new Date(),
          },
        },
      },
    });

    // Advance order → SHIPPED. The Bosta label already exists, so if the order
    // was concurrently moved out of PROCESSING (e.g. to ON_HOLD) we must NOT lose
    // the shipment — record it for manual reconciliation instead of throwing.
    try {
      await this.workflow.transition(
        order.id,
        OrderStatus.SHIPPED,
        { actorId, message: `Bosta shipment ${delivery.trackingNumber}` },
        {},
      );
      await this.workflow.logEvent(order.id, 'SHIPMENT_CREATED', delivery.trackingNumber);
    } catch (e: any) {
      this.logger.error(
        `Shipment ${delivery.trackingNumber} created for ${order.orderNumber} but SHIPPED transition failed: ${e.message}`,
      );
      await this.workflow
        .logEvent(
          order.id,
          'SHIPMENT_CREATED_NEEDS_STATUS_FIX',
          `Bosta ${delivery.trackingNumber} created but order could not move to SHIPPED: ${e.message}`,
        )
        .catch(() => undefined);
    }

    if (order.shopifyOrderId) {
      this.shopify
        .syncFulfillment(order.shopifyOrderId, delivery.trackingNumber, trackingUrl)
        .catch(() => undefined);
    }
    this.notifications.notifyOrder(order.id, 'SHIPMENT_CREATED').catch(() => undefined);

    return shipment;
  }

  /** Apply a Bosta status update (from webhook or polling) to a shipment. */
  async applyTrackingUpdate(params: {
    trackingNumber?: string;
    bostaDeliveryId?: string;
    state?: { value?: string; code?: number };
    location?: string;
    occurredAt?: Date;
    raw?: any;
  }) {
    // Guard: with no identifier at all, the OR below would reduce to empty
    // conditions and could match an arbitrary shipment. Ignore such updates.
    if (!params.trackingNumber && !params.bostaDeliveryId) {
      this.logger.warn('Bosta tracking update with no trackingNumber/deliveryId — ignoring');
      return;
    }
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        OR: [
          { trackingNumber: params.trackingNumber ?? undefined },
          { bostaDeliveryId: params.bostaDeliveryId ?? undefined },
        ],
      },
      include: { order: true },
    });
    if (!shipment) {
      this.logger.warn(`No shipment for tracking ${params.trackingNumber}`);
      return;
    }

    const prevStatus = shipment.status;
    const status = mapBostaState(params.state);
    await this.prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status,
        currentLocation: params.location,
        events: {
          create: {
            status,
            description: params.state?.value,
            location: params.location,
            occurredAt: params.occurredAt ?? new Date(),
            raw: params.raw,
          },
        },
      },
    });

    await this.mirrorOrderStatus(shipment.orderId, status);
    // Only notify the customer when the status actually CHANGED. Repeated webhooks
    // (Bosta is at-least-once) and location-only poll updates must not re-send the
    // same "in transit"/"out for delivery" message.
    if (status !== prevStatus) {
      await this.fireMilestoneNotification(shipment.orderId, status);
    }

    // Push to the public tracking SSE channel.
    this.realtime.publish(`tracking:${shipment.publicToken}`, {
      status,
      location: params.location,
      at: (params.occurredAt ?? new Date()).toISOString(),
    });
  }

  /**
   * Pull the latest status for every active Bosta shipment and feed real changes
   * through applyTrackingUpdate (which updates the shipment, mirrors the order,
   * fires milestone notifications, and pushes to the live /track SSE channel).
   *
   * Runs on an interval (BostaTrackingPoller) so the tracking system stays current
   * even when the Bosta webhook is missed or no public webhook URL is configured.
   * Only applies when the mapped status OR location actually changed, so polling
   * never appends duplicate timeline events or re-fires notifications.
   */
  async pollActiveShipments() {
    const TERMINAL: ShipmentStatus[] = [
      ShipmentStatus.DELIVERED,
      ShipmentStatus.RETURNED,
      ShipmentStatus.CANCELLED,
    ];
    const active = await this.prisma.shipment.findMany({
      where: { courier: 'BOSTA', trackingNumber: { not: null }, status: { notIn: TERMINAL } },
      select: { trackingNumber: true, status: true, currentLocation: true },
    });

    const processOne = async (s: {
      trackingNumber: string | null;
      status: ShipmentStatus;
      currentLocation: string | null;
    }) => {
      const tracked = await this.bosta.trackDelivery(s.trackingNumber!).catch((e) => {
        this.logger.warn(`Bosta track ${s.trackingNumber} failed: ${e.message}`);
        return null;
      });
      const state = tracked?.state as { value?: string; code?: number } | undefined;
      if (!state) return; // no usable state → don't risk downgrading status

      const mapped = mapBostaState(state);
      const location = tracked.currentLocation ?? undefined;

      // Nothing changed since last time → skip (no duplicate events).
      if (mapped === s.status && (location ?? null) === (s.currentLocation ?? null)) return;

      await this.applyTrackingUpdate({
        trackingNumber: s.trackingNumber!,
        state,
        location,
        raw: tracked,
      }).catch((e) => this.logger.error(`Apply Bosta update for ${s.trackingNumber} failed: ${e.message}`));
    };

    // Bounded concurrency: process in small batches so wall-clock scales with
    // active/CONCURRENCY (not the full count) and one slow Bosta call can't block
    // the rest or make a tick overrun the poll interval.
    const CONCURRENCY = 5;
    for (let i = 0; i < active.length; i += CONCURRENCY) {
      await Promise.all(active.slice(i, i + CONCURRENCY).map(processOne));
    }
  }

  private async mirrorOrderStatus(orderId: string, shipmentStatus: ShipmentStatus) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const target =
      shipmentStatus === ShipmentStatus.DELIVERED
        ? OrderStatus.DELIVERED
        : shipmentStatus === ShipmentStatus.RETURNED
          ? OrderStatus.RETURNED
          : null;
    if (target && this.workflow.canTransition(order.status, target)) {
      await this.workflow.transition(orderId, target, { message: `Bosta: ${shipmentStatus}` });
    }
  }

  private async fireMilestoneNotification(orderId: string, status: ShipmentStatus) {
    // "In Warehouse" (Bosta "received at warehouse" → PICKED_UP) is a one-shot
    // milestone: the courier can report it more than once (webhook + polling), so
    // it gets a dedicated send-once guard rather than firing on every update.
    if (status === ShipmentStatus.PICKED_UP) {
      await this.fireWarehouseArrivalOnce(orderId);
      return;
    }

    const map: Partial<Record<ShipmentStatus, Parameters<NotificationsService['notifyOrder']>[1]>> = {
      IN_TRANSIT: 'SHIPMENT_IN_TRANSIT',
      OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
      DELIVERED: 'DELIVERED',
    };
    const template = map[status];
    if (template) this.notifications.notifyOrder(orderId, template).catch(() => undefined);
  }

  /**
   * Notify the customer exactly once that their order has reached the warehouse.
   *
   * Bosta reports the same "received at warehouse" state from both the webhook and
   * the polling fallback, so to send the message only once per order we atomically
   * claim `Order.warehouseNotifiedAt` (same conditional-UPDATE pattern as the
   * shipment claim above): only the first caller flips it from null → now and gets
   * count === 1; every later report is a no-op. The send itself stays fire-and-
   * forget so a flaky email/SMS provider never blocks the tracking update — and the
   * flag stays set so we don't spam retries on each subsequent status poll.
   */
  private async fireWarehouseArrivalOnce(orderId: string) {
    const claim = await this.prisma.order.updateMany({
      where: { id: orderId, warehouseNotifiedAt: null },
      data: { warehouseNotifiedAt: new Date() },
    });
    if (claim.count === 0) return; // already notified for this order — skip

    // Best-effort, non-blocking send. If the customer was reachable but EVERY
    // channel failed (e.g. a transient email/SMS outage), release the claim so a
    // later webhook/poll retries — otherwise the once-only guard would lose the
    // message permanently. (attempted === 0 means no contact info → nothing to retry.)
    const releaseForRetry = () =>
      this.prisma.order
        .update({ where: { id: orderId }, data: { warehouseNotifiedAt: null } })
        .catch(() => undefined);

    this.notifications
      .notifyOrder(orderId, 'SHIPMENT_IN_WAREHOUSE')
      .then((r) => (r.attempted > 0 && r.sent === 0 ? releaseForRetry() : undefined))
      .catch(() => releaseForRetry());
  }

  /** Build a public, shareable tracking link for a shipment. */
  shareableLink(publicToken: string): string {
    return `${this.config.get('publicBaseUrl')}/track?token=${publicToken}`;
  }

  /** Amount still to collect on delivery = grand total − sum paid. */
  private async outstandingAmount(orderId: string, grandTotal: number): Promise<number> {
    const agg = await this.prisma.payment.aggregate({
      where: { orderId },
      _sum: { amountPaid: true },
    });
    const paid = Number(agg._sum.amountPaid ?? 0);
    return Math.max(0, grandTotal - paid);
  }

  async getByOrder(orderId: string) {
    return this.prisma.shipment.findMany({
      where: { orderId },
      include: { events: { orderBy: { occurredAt: 'asc' } } },
    });
  }
}
