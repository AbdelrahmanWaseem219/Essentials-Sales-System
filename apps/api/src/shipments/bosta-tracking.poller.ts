import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShipmentsService } from './shipments.service';

/**
 * Periodically pulls Bosta for status changes on active shipments and applies
 * them to the tracking system. Polling (us → Bosta) complements the inbound
 * webhook so tracking still updates when a webhook is missed or no public
 * webhook URL is configured (e.g. local dev).
 *
 * Interval is BOSTA_POLL_SECONDS (0 disables).
 */
@Injectable()
export class BostaTrackingPoller implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BostaTrackingPoller.name);
  private readonly seconds: number;
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly shipments: ShipmentsService,
    config: ConfigService,
  ) {
    this.seconds = config.get<number>('bosta.pollSeconds') ?? 0;
  }

  onModuleInit() {
    if (this.seconds <= 0) {
      this.logger.log('Bosta tracking polling disabled (BOSTA_POLL_SECONDS=0)');
      return;
    }
    this.logger.log(`Bosta tracking polling every ${this.seconds}s`);
    this.timer = setInterval(() => this.tick(), this.seconds * 1000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return; // avoid overlap on slow Bosta calls
    this.running = true;
    try {
      await this.shipments.pollActiveShipments();
    } catch (e: any) {
      this.logger.error(`Bosta tracking poll failed: ${e.message}`);
    } finally {
      this.running = false;
    }
  }
}
