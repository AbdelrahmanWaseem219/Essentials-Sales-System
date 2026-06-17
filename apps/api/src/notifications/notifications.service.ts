import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailAdapter } from './channels/email.adapter';
import { SmsAdapter } from './channels/sms.adapter';
import { WhatsappAdapter } from './channels/whatsapp.adapter';
import { NotificationChannelAdapter } from './channels/channel.interface';
import { NotificationTemplate, renderTemplate } from './templates';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly adapters: Record<NotificationChannel, NotificationChannelAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    email: EmailAdapter,
    sms: SmsAdapter,
    whatsapp: WhatsappAdapter,
  ) {
    this.adapters = {
      EMAIL: email,
      SMS: sms,
      WHATSAPP: whatsapp,
    };
  }

  /**
   * Resolve an order + customer and send a templated notification across the
   * customer's available channels. Each send is recorded in `Notification`.
   */
  async notifyOrder(
    orderId: string,
    template: NotificationTemplate,
  ): Promise<{ attempted: number; sent: number }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, shipments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order) return { attempted: 0, sent: 0 };

    const shipment = order.shipments[0];
    const ctx = {
      customerName: [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' '),
      orderNumber: order.orderNumber,
      trackingNumber: shipment?.trackingNumber ?? undefined,
      trackingUrl: shipment?.trackingUrl ?? undefined,
    };
    const { subject, body } = renderTemplate(template, ctx);

    const targets: { channel: NotificationChannel; to?: string | null }[] = [
      { channel: 'EMAIL', to: order.customer.email },
      { channel: 'SMS', to: order.customer.phone },
      { channel: 'WHATSAPP', to: order.customer.phone },
    ];

    // Only channels the customer actually has a destination for. Returning the
    // attempted/sent counts lets one-shot callers (e.g. the warehouse milestone)
    // detect a total send failure and decide whether to retry.
    const reachable = targets.filter((t) => !!t.to);
    const results = await Promise.all(
      reachable.map((t) =>
        this.dispatch(t.channel, t.to!, template, { subject, body }, order.id, order.customerId),
      ),
    );
    return { attempted: reachable.length, sent: results.filter(Boolean).length };
  }

  private async dispatch(
    channel: NotificationChannel,
    to: string,
    template: string,
    msg: { subject: string; body: string },
    orderId?: string,
    customerId?: string,
  ): Promise<boolean> {
    const record = await this.prisma.notification.create({
      data: { channel, to, template, orderId, customerId, status: NotificationStatus.PENDING },
    });
    try {
      await this.adapters[channel].send({ to, subject: msg.subject, body: msg.body });
      await this.prisma.notification.update({
        where: { id: record.id },
        data: { status: NotificationStatus.SENT, sentAt: new Date() },
      });
      return true;
    } catch (e: any) {
      this.logger.error(`Notification ${channel} → ${to} failed: ${e.message}`);
      await this.prisma.notification.update({
        where: { id: record.id },
        data: { status: NotificationStatus.FAILED, error: e.message },
      });
      return false;
    }
  }
}
