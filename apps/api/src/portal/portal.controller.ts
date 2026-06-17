import { Controller, ForbiddenException, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

/**
 * Customer-facing portal API (scoped to the authenticated customer).
 * Lets customers view their orders, invoices, payment status and shipments.
 */
@ApiTags('portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
@Controller('portal')
export class PortalController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('profile')
  profile(@CurrentUser() user: AuthUser) {
    return this.prisma.customer.findUnique({
      where: { id: user.sub },
      select: { id: true, email: true, phone: true, firstName: true, lastName: true, addresses: true },
    });
  }

  @Get('orders')
  orders(@CurrentUser() user: AuthUser) {
    return this.prisma.order.findMany({
      where: { customerId: user.sub },
      include: { items: true, payments: true, shipments: true },
      orderBy: { placedAt: 'desc' },
    });
  }

  @Get('orders/:id')
  async order(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        payments: { include: { refunds: true } },
        shipments: { include: { events: { orderBy: { occurredAt: 'asc' } } } },
        shippingAddress: true,
      },
    });
    if (!order || order.customerId !== user.sub) throw new ForbiddenException();
    return order;
  }

  /** A lightweight invoice view derived from the order + payments. */
  @Get('orders/:id/invoice')
  async invoice(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, payments: true, customer: true, billingAddress: true },
    });
    if (!order || order.customerId !== user.sub) throw new ForbiddenException();
    return {
      invoiceNumber: `INV-${order.orderNumber}`,
      issuedAt: order.placedAt,
      billTo: {
        name: [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' '),
        email: order.customer.email,
        address: order.billingAddress,
      },
      lines: order.items.map((i) => ({
        sku: i.sku,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.totalPrice,
      })),
      totals: {
        subtotal: order.subtotal,
        shipping: order.shippingTotal,
        discount: order.discountTotal,
        tax: order.taxTotal,
        grandTotal: order.grandTotal,
      },
      payment: order.payments[0]
        ? { method: order.payments[0].method, status: order.payments[0].status }
        : null,
    };
  }
}
