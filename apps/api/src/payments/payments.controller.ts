import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PaymentsService } from './payments.service';
import { RecordPaymentDto, RefundDto } from './dto/payment.dto';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SALES_MANAGER, Role.SALES_AGENT)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('order/:orderId')
  list(@Param('orderId') orderId: string) {
    return this.payments.listByOrder(orderId);
  }

  @Post('order/:orderId')
  record(@Param('orderId') orderId: string, @Body() dto: RecordPaymentDto) {
    return this.payments.record(orderId, dto);
  }

  @Post(':paymentId/refund')
  @Roles(Role.ADMIN, Role.SALES_MANAGER)
  refund(@Param('paymentId') paymentId: string, @Body() dto: RefundDto) {
    return this.payments.refund(paymentId, dto);
  }
}
