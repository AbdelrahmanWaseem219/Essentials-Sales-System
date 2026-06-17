import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { NotificationChannelAdapter, OutboundMessage } from './channel.interface';

/**
 * WhatsApp Business adapter (Cloud API style). No-ops if unconfigured.
 */
@Injectable()
export class WhatsappAdapter implements NotificationChannelAdapter {
  readonly name = 'WHATSAPP' as const;
  private readonly logger = new Logger(WhatsappAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async send(msg: OutboundMessage): Promise<void> {
    const url = this.config.get<string>('whatsapp.url');
    if (!url) {
      this.logger.debug(`[whatsapp:noop] → ${msg.to} :: ${msg.body.slice(0, 60)}`);
      return;
    }
    await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to: msg.to,
        type: 'text',
        text: { body: msg.body },
      },
      { headers: { Authorization: `Bearer ${this.config.get('whatsapp.key')}` } },
    );
  }
}
