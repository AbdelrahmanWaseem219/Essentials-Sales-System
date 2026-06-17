import { Module } from '@nestjs/common';
import { OrdersModule } from '../../orders/orders.module';
import { ShopifyController } from './shopify.controller';
import { ShopifyAdminController } from './shopify-admin.controller';
import { ShopifyService } from './shopify.service';

@Module({
  imports: [OrdersModule],
  controllers: [ShopifyController, ShopifyAdminController],
  providers: [ShopifyService],
  exports: [ShopifyService],
})
export class ShopifyModule {}
