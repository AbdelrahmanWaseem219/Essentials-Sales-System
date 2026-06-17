import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SALES_MANAGER)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  summary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.summary(from, to);
  }

  @Get('revenue')
  revenue(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analytics.revenueByDay(from, to);
  }

  @Get('top-customers')
  topCustomers() {
    return this.analytics.topCustomers();
  }

  @Get('top-products')
  topProducts() {
    return this.analytics.topProducts();
  }
}
