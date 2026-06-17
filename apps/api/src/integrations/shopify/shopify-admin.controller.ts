import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ShopifyService } from './shopify.service';

@ApiTags('shopify')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SALES_MANAGER)
@Controller('shopify')
export class ShopifyAdminController {
  constructor(private readonly shopify: ShopifyService) {}

  /** Import ALL historical Shopify orders (one-time). Idempotent. */
  @Post('backfill')
  backfill() {
    return this.shopify.backfillAllOrders();
  }
}
