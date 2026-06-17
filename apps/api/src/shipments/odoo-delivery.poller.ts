import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShipmentsService } from './shipments.service';

/**
 * Periodically asks Odoo whether any order's final Delivery transfer has been
 * validated, and auto-creates the Bosta shipment when it has. Polling (outbound
 * from us → Odoo) is used instead of an inbound Odoo webhook so it works even
 * behind a changing ngrok URL / no public endpoint.
 *
 * Interval is ODOO_POLL_SECONDS (0 disables).
 */
@Injectable()
export class OdooDeliveryPoller implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OdooDeliveryPoller.name);
  private readonly seconds: number;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly shipments: ShipmentsService,
    config: ConfigService,
  ) {
    this.seconds = config.get<number>('odoo.pollSeconds') ?? 0;
  }

  onModuleInit() {
    if (this.seconds <= 0) {
      this.logger.log('Odoo delivery polling disabled (ODOO_POLL_SECONDS=0)');
      return;
    }
    this.logger.log(`Odoo delivery polling every ${this.seconds}s`);
    this.timer = setInterval(() => this.tick(), this.seconds * 1000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return; // avoid overlap on slow Odoo calls
    this.running = true;
    try {
      await this.shipments.syncValidatedDeliveries();
    } catch (e: any) {
      this.logger.error(`Delivery poll failed: ${e.message}`);
    } finally {
      this.running = false;
    }
  }
}
