import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { NotificationChannelAdapter, OutboundMessage } from './channel.interface';

/**
 * Provider-agnostic SMS adapter. Posts to a configurable HTTP gateway
 * (Twilio-style or a local Egyptian SMS provider). No-ops if unconfigured.
 */
@Injectable()
export class SmsAdapter implements NotificationChannelAdapter {
  readonly name = 'SMS' as const;
  private readonly logger = new Logger(SmsAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async send(msg: OutboundMessage): Promise<void> {
    const url = this.config.get<string>('sms.url');
    if (!url) {
      this.logger.debug(`[sms:noop] → ${msg.to} :: ${msg.body.slice(0, 60)}`);
      return;
    }
    await axios.post(
      url,
      { to: msg.to, message: msg.body },
      { headers: { Authorization: `Bearer ${this.config.get('sms.key')}` } },
    );
  }
}
