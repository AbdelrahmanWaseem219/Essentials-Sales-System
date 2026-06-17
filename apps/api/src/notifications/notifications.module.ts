import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { EmailAdapter } from './channels/email.adapter';
import { SmsAdapter } from './channels/sms.adapter';
import { WhatsappAdapter } from './channels/whatsapp.adapter';

@Module({
  providers: [NotificationsService, EmailAdapter, SmsAdapter, WhatsappAdapter],
  exports: [NotificationsService],
})
export class NotificationsModule {}
