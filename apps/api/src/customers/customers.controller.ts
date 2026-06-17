import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { CustomersService } from './customers.service';
import {
  CreateCustomerDto,
  CreateNoteDto,
  CustomerQueryDto,
  UpsertAddressDto,
} from './dto/customer.dto';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SALES_MANAGER, Role.SALES_AGENT)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@Query() q: CustomerQueryDto) {
    return this.customers.findMany(q);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.customers.history(id);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: CreateCustomerDto) {
    return this.customers.update(id, dto);
  }

  @Post(':id/addresses')
  addAddress(@Param('id') id: string, @Body() dto: UpsertAddressDto) {
    return this.customers.addAddress(id, dto);
  }

  @Patch('addresses/:addressId')
  updateAddress(@Param('addressId') addressId: string, @Body() dto: UpsertAddressDto) {
    return this.customers.updateAddress(addressId, dto);
  }

  @Delete('addresses/:addressId')
  deleteAddress(@Param('addressId') addressId: string) {
    return this.customers.deleteAddress(addressId);
  }

  @Post(':id/notes')
  addNote(@Param('id') id: string, @Body() dto: CreateNoteDto, @CurrentUser() user: AuthUser) {
    return this.customers.addNote(id, user.sub, dto);
  }
}
