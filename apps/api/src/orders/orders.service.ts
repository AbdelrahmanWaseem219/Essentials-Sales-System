import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrderStatus, OrderSource, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { OdooService } from '../integrations/odoo/odoo.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderWorkflowService } from './workflow/order-workflow.service';
import { OrderNumberService } from './order-number.service';
import { CreateManualOrderDto, OrderQueryDto, StatusActionDto } from './dto/order.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: OrderWorkflowService,
    private readonly odoo: OdooService,
    private readonly notifications: NotificationsService,
    private readonly orderNumber: OrderNumberService,
  ) {}

  // ── queries ─────────────────────────────────────────

  async findMany(q: OrderQueryDto) {
    const where: Prisma.OrderWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.customerId) where.customerId = q.customerId;
    if (q.from || q.to) {
      where.placedAt = {};
      if (q.from) where.placedAt.gte = new Date(q.from);
      if (q.to) where.placedAt.lte = new Date(q.to);
    }
    if (q.search) {
      where.OR = [
        { orderNumber: { contains: q.search, mode: 'insensitive' } },
        { shopifyOrderName: { contains: q.search, mode: 'insensitive' } },
        { customer: { firstName: { contains: q.search, mode: 'insensitive' } } },
        { customer: { lastName: { contains: q.search, mode: 'insensitive' } } },
        { customer: { phone: { contains: q.search } } },
      ];
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: { customer: true, items: true, payments: true, shipments: true },
        orderBy: { placedAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
    ]);
    return { data, total, page: q.page, pageSize: q.pageSize };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        shippingAddress: true,
        billingAddress: true,
        items: true,
        payments: { include: { refunds: true } },
        shipments: { include: { events: { orderBy: { occurredAt: 'asc' } } } },
        events: { orderBy: { createdAt: 'desc' }, include: { actor: true } },
        approvedBy: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // ── manual order creation ───────────────────────────

  async createManual(dto: CreateManualOrderDto, actorId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const items = dto.items.map((i) => ({
      sku: i.sku,
      name: i.name,
      quantity: i.quantity,
      unitPrice: new Prisma.Decimal(i.unitPrice),
      totalPrice: new Prisma.Decimal(i.unitPrice * i.quantity),
    }));
    const subtotal = items.reduce((s, i) => s.plus(i.totalPrice), new Prisma.Decimal(0));
    const shipping = new Prisma.Decimal(dto.shippingTotal ?? 0);
    const discount = new Prisma.Decimal(dto.discountTotal ?? 0);
    const grand = subtotal.plus(shipping).minus(discount);

    const order = await this.prisma.order.create({
      data: {
        orderNumber: await this.orderNumber.next(),
        source: OrderSource.MANUAL,
        status: OrderStatus.PENDING_REVIEW,
        customerId: dto.customerId,
        shippingAddressId: dto.shippingAddressId,
        currency: dto.currency ?? 'EGP',
        subtotal,
        shippingTotal: shipping,
        discountTotal: discount,
        grandTotal: grand,
        customerNote: dto.customerNote,
        items: { create: items },
        events: { create: { type: 'CREATED', message: 'Manual order created', actorId } },
      },
      include: { items: true },
    });
    return order;
  }

  // ── approval actions ────────────────────────────────

  async approve(id: string, actorId: string, dto: StatusActionDto) {
    const order = await this.workflow.transition(
      id,
      OrderStatus.APPROVED,
      { actorId, message: dto.note },
      { approvedBy: { connect: { id: actorId } }, approvedAt: new Date() },
    );
    // Fire-and-forget side effects (in production these are BullMQ jobs).
    // On Odoo-push failure, surface it: record an event and put the order ON_HOLD
    // with a reason so an agent sees it needs attention (instead of it silently
    // sitting in APPROVED with no Odoo picking).
    this.pushToOdoo(id, actorId).catch(async (e) => {
      this.logger.error(`Odoo push failed for ${order.orderNumber}: ${e.message}`);
      await this.workflow.logEvent(id, 'ODOO_PUSH_FAILED', e.message).catch(() => undefined);
      await this.workflow
        .transition(
          id,
          OrderStatus.ON_HOLD,
          { actorId, message: `Odoo push failed: ${e.message}` },
          { holdReason: `Odoo push failed: ${e.message}` },
        )
        .catch(() => undefined);
    });
    this.notifications.notifyOrder(id, 'ORDER_APPROVED').catch(() => undefined);
    return order;
  }

  reject(id: string, actorId: string, dto: StatusActionDto) {
    return this.workflow.transition(id, OrderStatus.REJECTED, {
      actorId,
      message: dto.reason ?? 'Rejected',
    });
  }

  hold(id: string, actorId: string, dto: StatusActionDto) {
    return this.workflow.transition(
      id,
      OrderStatus.ON_HOLD,
      { actorId, message: dto.reason },
      { holdReason: dto.reason },
    );
  }

  release(id: string, actorId: string) {
    return this.workflow.transition(id, OrderStatus.PENDING_REVIEW, {
      actorId,
      message: 'Hold released',
    });
  }

  async cancel(id: string, actorId: string, dto: StatusActionDto) {
    const existing = await this.prisma.order.findUniqueOrThrow({ where: { id } });
    // If already pushed to Odoo, cancel the picking there too.
    if (existing.odooPickingId) {
      await this.odoo.cancelDelivery(existing.odooPickingId).catch((e) =>
        this.logger.warn(`Could not cancel Odoo picking ${existing.odooPickingId}: ${e.message}`),
      );
    }
    return this.workflow.transition(
      id,
      OrderStatus.CANCELLED,
      { actorId, message: dto.reason },
      { cancelReason: dto.reason },
    );
  }

  // ── Odoo push (called on approval; also exposed for retry) ──

  async pushToOdoo(id: string, actorId?: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id },
      include: { items: true, customer: true, shippingAddress: true },
    });
    if (order.odooPickingId) return order; // idempotent

    const pickingId = await this.odoo.pushDelivery({
      origin: order.orderNumber,
      partner: {
        name:
          [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ') ||
          order.customer.email ||
          order.orderNumber,
        email: order.customer.email,
        phone: order.customer.phone,
        street: order.shippingAddress?.line1,
        city: order.shippingAddress?.city,
      },
      lines: order.items.map((i) => ({ sku: i.sku, name: i.name, quantity: i.quantity })),
    });

    await this.workflow.transition(
      id,
      OrderStatus.SENT_TO_ODOO,
      { actorId, message: `Pushed to Odoo picking #${pickingId}`, metadata: { pickingId } },
      { odooPickingId: pickingId, odooPushedAt: new Date() },
    );
    // Odoo reserved stock → move to PROCESSING.
    const updated = await this.workflow.transition(id, OrderStatus.PROCESSING, {
      actorId,
      message: 'Odoo reserved stock',
    });
    await this.workflow.logEvent(id, 'ODOO_PUSH', `picking #${pickingId}`, { pickingId });
    return updated;
  }

  // ── helpers ─────────────────────────────────────────

  async assertExists(id: string) {
    const exists = await this.prisma.order.count({ where: { id } });
    if (!exists) throw new BadRequestException('Order not found');
  }
}
