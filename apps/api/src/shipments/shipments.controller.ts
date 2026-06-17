import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ShipmentsService } from './shipments.service';

@ApiTags('shipments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SALES_MANAGER, Role.SALES_AGENT)
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipments: ShipmentsService) {}

  /** Manually create a Bosta shipment for an order. */
  @Post('order/:orderId')
  create(@Param('orderId') orderId: string, @CurrentUser() user: AuthUser) {
    return this.shipments.createForOrder(orderId, user.sub);
  }

  @Get('order/:orderId')
  byOrder(@Param('orderId') orderId: string) {
    return this.shipments.getByOrder(orderId);
  }
}
