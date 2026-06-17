import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Allowed transitions. Anything not listed throws. See docs/WORKFLOW.md. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_REVIEW: ['APPROVED', 'REJECTED', 'ON_HOLD', 'CANCELLED', 'PAYMENT_PENDING'],
  PAYMENT_PENDING: ['PENDING_REVIEW', 'CANCELLED'],
  APPROVED: ['SENT_TO_ODOO', 'ON_HOLD', 'CANCELLED'],
  SENT_TO_ODOO: ['PROCESSING', 'ON_HOLD'],
  PROCESSING: ['SHIPPED', 'ON_HOLD', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'RETURNED'],
  DELIVERED: ['RETURNED'],
  ON_HOLD: ['PENDING_REVIEW', 'APPROVED', 'PROCESSING', 'CANCELLED'],
  REJECTED: [],
  CANCELLED: [],
  RETURNED: [],
};

interface TransitionMeta {
  actorId?: string;
  message?: string;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class OrderWorkflowService {
  private readonly logger = new Logger(OrderWorkflowService.name);

  constructor(private readonly prisma: PrismaService) {}

  canTransition(from: OrderStatus, to: OrderStatus): boolean {
    return TRANSITIONS[from]?.includes(to) ?? false;
  }

  /**
   * Transition an order to a new status inside a transaction, writing an audit
   * OrderEvent. Extra `data` is merged into the Order update (e.g. reasons,
   * odooPickingId, approvedBy). Returns the updated order.
   */
  async transition(
    orderId: string,
    to: OrderStatus,
    meta: TransitionMeta = {},
    data: Prisma.OrderUpdateInput = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      const from = order.status;

      if (from === to) return order; // idempotent no-op

      if (!this.canTransition(from, to)) {
        throw new BadRequestException(`Illegal order transition ${from} → ${to}`);
      }

      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: to, ...data },
      });

      await tx.orderEvent.create({
        data: {
          orderId,
          fromStatus: from,
          toStatus: to,
          type: 'STATUS_CHANGE',
          message: meta.message,
          actorId: meta.actorId,
          metadata: meta.metadata,
        },
      });

      this.logger.log(`Order ${order.orderNumber}: ${from} → ${to}`);
      return updated;
    });
  }

  /** Record a non-transition event (note, integration callback, etc). */
  async logEvent(orderId: string, type: string, message?: string, metadata?: Prisma.InputJsonValue) {
    return this.prisma.orderEvent.create({
      data: { orderId, type, message, metadata },
    });
  }
}
