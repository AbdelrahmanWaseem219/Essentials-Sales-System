import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { buildTimeline } from './tracking.mapper';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public lookup by shareable token, tracking number, or order number. */
  async lookup(query: { token?: string; trackingNumber?: string; orderNumber?: string }) {
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        OR: [
          query.token ? { publicToken: query.token } : undefined,
          query.trackingNumber ? { trackingNumber: query.trackingNumber } : undefined,
          query.orderNumber ? { order: { orderNumber: query.orderNumber } } : undefined,
        ].filter(Boolean) as any,
      },
      include: {
        order: { select: { orderNumber: true, status: true, placedAt: true } },
        events: { orderBy: { occurredAt: 'asc' } },
      },
    });

    // Order number with no shipment yet (pre-ship): still show early timeline.
    if (!shipment && query.orderNumber) {
      const order = await this.prisma.order.findUnique({
        where: { orderNumber: query.orderNumber },
        select: { orderNumber: true, status: true, placedAt: true },
      });
      if (!order) throw new NotFoundException('Not found');
      return {
        orderNumber: order.orderNumber,
        courier: null,
        trackingNumber: null,
        status: order.status,
        estimatedDeliveryAt: null,
        currentLocation: null,
        timeline: buildTimeline(order.status, null),
        history: [],
      };
    }

    if (!shipment) throw new NotFoundException('Not found');

    return {
      orderNumber: shipment.order.orderNumber,
      courier: shipment.courier,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      status: shipment.status,
      estimatedDeliveryAt: shipment.estimatedDeliveryAt,
      currentLocation: shipment.currentLocation,
      publicToken: shipment.publicToken,
      timeline: buildTimeline(shipment.order.status, shipment.status),
      history: shipment.events.map((e) => ({
        status: e.status,
        description: e.description,
        location: e.location,
        at: e.occurredAt,
      })),
    };
  }

  async resolveToken(token: string) {
    const shipment = await this.prisma.shipment.findUnique({ where: { publicToken: token } });
    if (!shipment) throw new NotFoundException('Invalid tracking token');
    return shipment;
  }
}
