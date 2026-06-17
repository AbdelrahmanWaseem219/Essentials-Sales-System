import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { RealtimeModule } from './common/realtime/realtime.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { Reflector } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ShipmentsModule } from './shipments/shipments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TrackingModule } from './tracking/tracking.module';
import { PortalModule } from './portal/portal.module';
import { OdooModule } from './integrations/odoo/odoo.module';
import { ShopifyModule } from './integrations/shopify/shopify.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    // Infra (global)
    PrismaModule,
    RedisModule,
    RealtimeModule,
    OdooModule,
    // Features
    AuthModule,
    UsersModule,
    CustomersModule,
    NotificationsModule,
    OrdersModule,
    PaymentsModule,
    ShopifyModule,
    ShipmentsModule,
    AnalyticsModule,
    TrackingModule,
    PortalModule,
  ],
  controllers: [HealthController],
  providers: [
    // Global JWT auth; routes opt out with @Public()
    { provide: APP_GUARD, useFactory: (ref: Reflector) => new JwtAuthGuard(ref), inject: [Reflector] },
  ],
})
export class AppModule {}
