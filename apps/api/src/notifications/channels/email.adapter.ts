import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannelAdapter, OutboundMessage } from './channel.interface';

/**
 * SMTP email adapter. Uses nodemailer when SMTP is configured; otherwise logs
 * (so the system runs end-to-end in dev without real credentials).
 */
@Injectable()
export class EmailAdapter implements NotificationChannelAdapter {
  readonly name = 'EMAIL' as const;
  private readonly logger = new Logger(EmailAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async send(msg: OutboundMessage): Promise<void> {
    const host = this.config.get<string>('mail.host');
    const user = this.config.get<string>('mail.user');
    const pass = this.config.get<string>('mail.pass');
    // No-op until SMTP is fully configured, so unconfigured installs don't log
    // a failed send for every notification.
    if (!host || !user || !pass) {
      this.logger.debug(`[email:noop] → ${msg.to} :: ${msg.subject}`);
      return;
    }
    // Lazy import so nodemailer is optional at install time in dev.
    const nodemailer = await import('nodemailer').catch(() => null);
    if (!nodemailer) {
      this.logger.warn('nodemailer not installed; skipping email send');
      return;
    }
    const transport = nodemailer.createTransport({
      host,
      port: this.config.get<number>('mail.port'),
      auth: { user: this.config.get('mail.user'), pass: this.config.get('mail.pass') },
    });
    await transport.sendMail({
      from: this.config.get('mail.from'),
      to: msg.to,
      subject: msg.subject,
      html: msg.body,
    });
  }
}
