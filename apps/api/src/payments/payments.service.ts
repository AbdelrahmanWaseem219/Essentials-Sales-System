import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RecordPaymentDto, RefundDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  listByOrder(orderId: string) {
    return this.prisma.payment.findMany({
      where: { orderId },
      include: { refunds: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Record a payment (or top-up) against an order; recomputes status. */
  async record(orderId: string, dto: RecordPaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    const existing = order.payments[0];
    const amount = new Prisma.Decimal(dto.amount);

    if (existing) {
      const newPaid = new Prisma.Decimal(existing.amountPaid).plus(amount);
      const status = this.deriveStatus(newPaid, new Prisma.Decimal(existing.amount));
      return this.prisma.payment.update({
        where: { id: existing.id },
        data: {
          amountPaid: newPaid,
          method: dto.method,
          status,
          reference: dto.reference ?? existing.reference,
          paidAt: status === PaymentStatus.PAID ? new Date() : existing.paidAt,
        },
        include: { refunds: true },
      });
    }

    const status = this.deriveStatus(amount, new Prisma.Decimal(order.grandTotal));
    return this.prisma.payment.create({
      data: {
        orderId,
        method: dto.method,
        amount: order.grandTotal,
        amountPaid: amount,
        status,
        reference: dto.reference,
        paidAt: status === PaymentStatus.PAID ? new Date() : null,
      },
      include: { refunds: true },
    });
  }

  async refund(paymentId: string, dto: RefundDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { refunds: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const alreadyRefunded = payment.refunds.reduce(
      (s, r) => s.plus(r.amount),
      new Prisma.Decimal(0),
    );
    const totalRefund = alreadyRefunded.plus(dto.amount);
    if (totalRefund.greaterThan(payment.amountPaid)) {
      throw new BadRequestException('Refund exceeds amount paid');
    }
    const status = totalRefund.equals(payment.amountPaid)
      ? PaymentStatus.REFUNDED
      : PaymentStatus.PARTIALLY_REFUNDED;

    await this.prisma.refund.create({
      data: {
        paymentId,
        amount: new Prisma.Decimal(dto.amount),
        reason: dto.reason,
        reference: dto.reference,
      },
    });
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { status },
      include: { refunds: true },
    });
  }

  private deriveStatus(paid: Prisma.Decimal, total: Prisma.Decimal): PaymentStatus {
    if (paid.greaterThanOrEqualTo(total) && total.greaterThan(0)) return PaymentStatus.PAID;
    if (paid.greaterThan(0)) return PaymentStatus.PARTIALLY_PAID;
    return PaymentStatus.PENDING;
  }
}
