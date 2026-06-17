import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ShopifyModule } from '../integrations/shopify/shopify.module';
import { BostaClient } from '../integrations/bosta/bosta.client';
import { BostaController } from '../integrations/bosta/bosta.controller';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';
import { OdooDeliveryPoller } from './odoo-delivery.poller';
import { BostaTrackingPoller } from './bosta-tracking.poller';

@Module({
  imports: [OrdersModule, NotificationsModule, ShopifyModule],
  controllers: [ShipmentsController, BostaController],
  providers: [ShipmentsService, BostaClient, OdooDeliveryPoller, BostaTrackingPoller],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
