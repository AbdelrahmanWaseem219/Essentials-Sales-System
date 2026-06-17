import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateManualOrderDto, OrderQueryDto, StatusActionDto } from './dto/order.dto';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SALES_MANAGER, Role.SALES_AGENT)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Query() q: OrderQueryDto) {
    return this.orders.findMany(q);
  }

  @Get('approval-queue')
  queue(@Query() q: OrderQueryDto) {
    return this.orders.findMany({ ...q, status: 'PENDING_REVIEW' });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.orders.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateManualOrderDto, @CurrentUser() user: AuthUser) {
    return this.orders.createManual(dto, user.sub);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() dto: StatusActionDto, @CurrentUser() user: AuthUser) {
    return this.orders.approve(id, user.sub, dto);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: StatusActionDto, @CurrentUser() user: AuthUser) {
    return this.orders.reject(id, user.sub, dto);
  }

  @Post(':id/hold')
  hold(@Param('id') id: string, @Body() dto: StatusActionDto, @CurrentUser() user: AuthUser) {
    return this.orders.hold(id, user.sub, dto);
  }

  @Post(':id/release')
  release(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.release(id, user.sub);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: StatusActionDto, @CurrentUser() user: AuthUser) {
    return this.orders.cancel(id, user.sub, dto);
  }

  @Post(':id/push-odoo')
  pushOdoo(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.pushToOdoo(id, user.sub);
  }
}
