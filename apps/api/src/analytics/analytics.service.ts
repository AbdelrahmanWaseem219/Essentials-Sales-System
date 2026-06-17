import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private range(from?: string, to?: string) {
    const gte = from ? new Date(from) : new Date(Date.now() - 30 * 864e5);
    const lte = to ? new Date(to) : new Date();
    return { gte, lte };
  }

  async summary(from?: string, to?: string) {
    const placedAt = this.range(from, to);
    const valid = { notIn: [OrderStatus.CANCELLED, OrderStatus.REJECTED] };

    const [revenue, orderCount, delivered, returned, pendingReview] = await this.prisma.$transaction([
      this.prisma.order.aggregate({
        where: { placedAt, status: valid },
        _sum: { grandTotal: true },
      }),
      this.prisma.order.count({ where: { placedAt } }),
      this.prisma.order.count({ where: { placedAt, status: 'DELIVERED' } }),
      this.prisma.order.count({ where: { placedAt, status: 'RETURNED' } }),
      this.prisma.order.count({ where: { status: 'PENDING_REVIEW' } }),
    ]);

    const fulfilled = delivered + returned;
    return {
      revenue: revenue._sum?.grandTotal ?? 0,
      orderCount,
      delivered,
      returned,
      returnRate: fulfilled ? returned / fulfilled : 0,
      pendingReview,
    };
  }

  /** Revenue grouped by day for charting. */
  async revenueByDay(from?: string, to?: string) {
    const { gte, lte } = this.range(from, to);
    const rows = await this.prisma.$queryRaw<{ day: Date; revenue: number; orders: bigint }[]>`
      SELECT date_trunc('day', "placedAt") AS day,
             COALESCE(SUM("grandTotal"), 0)::float AS revenue,
             COUNT(*) AS orders
      FROM "Order"
      WHERE "placedAt" BETWEEN ${gte} AND ${lte}
        AND "status" NOT IN ('CANCELLED', 'REJECTED')
      GROUP BY 1 ORDER BY 1`;
    return rows.map((r) => ({ day: r.day, revenue: r.revenue, orders: Number(r.orders) }));
  }

  async topCustomers(limit = 10) {
    const grouped = await this.prisma.order.groupBy({
      by: ['customerId'],
      where: { status: { notIn: ['CANCELLED', 'REJECTED'] } },
      _sum: { grandTotal: true },
      _count: true,
      orderBy: { _sum: { grandTotal: 'desc' } },
      take: limit,
    });
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: grouped.map((g) => g.customerId) } },
    });
    const byId = new Map(customers.map((c) => [c.id, c]));
    return grouped.map((g) => ({
      customer: byId.get(g.customerId),
      totalSpent: g._sum.grandTotal ?? 0,
      orders: g._count,
    }));
  }

  async topProducts(limit = 10) {
    const grouped = await this.prisma.orderItem.groupBy({
      by: ['sku', 'name'],
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: limit,
    });
    return grouped.map((g) => ({
      sku: g.sku,
      name: g.name,
      unitsSold: g._sum.quantity ?? 0,
      revenue: g._sum.totalPrice ?? 0,
    }));
  }
}
