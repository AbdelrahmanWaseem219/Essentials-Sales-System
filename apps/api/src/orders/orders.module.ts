import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderIngestionService } from './order-ingestion.service';
import { OrderNumberService } from './order-number.service';
import { OrderWorkflowService } from './workflow/order-workflow.service';

@Module({
  imports: [NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderIngestionService, OrderNumberService, OrderWorkflowService],
  exports: [OrdersService, OrderIngestionService, OrderWorkflowService],
})
export class OrdersModule {}
