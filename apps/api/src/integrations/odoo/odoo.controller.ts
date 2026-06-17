import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { OdooService } from './odoo.service';

@ApiTags('odoo')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SALES_MANAGER, Role.SALES_AGENT)
@Controller('odoo')
export class OdooController {
  constructor(private readonly odoo: OdooService) {}

  @Get('products')
  search(@Query('q') q: string) {
    return this.odoo.searchProducts(q ?? '');
  }

  @Get('products/:sku')
  product(@Param('sku') sku: string) {
    return this.odoo.getProductBySku(sku);
  }

  @Get('products/:sku/stock')
  async stock(@Param('sku') sku: string) {
    return { sku, qtyAvailable: await this.odoo.getStockAvailability(sku) };
  }

  @Get('warehouses')
  warehouses() {
    return this.odoo.listWarehouses();
  }
}
