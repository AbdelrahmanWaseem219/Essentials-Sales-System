import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class OrderQueryDto {
  @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
  @IsOptional() @IsString() search?: string; // order number, customer name/phone
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() from?: string; // ISO date
  @IsOptional() @IsString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize = 25;
}

export class ManualOrderItemDto {
  @IsString() sku!: string;
  @IsString() name!: string;
  @Type(() => Number) @IsInt() @Min(1) quantity!: number;
  @Type(() => Number) @IsNumber() @Min(0) unitPrice!: number;
}

export class CreateManualOrderDto {
  @IsString() customerId!: string;
  @IsOptional() @IsString() shippingAddressId?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() shippingTotal?: number;
  @IsOptional() @IsNumber() discountTotal?: number;
  @IsOptional() @IsString() customerNote?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ManualOrderItemDto)
  items!: ManualOrderItemDto[];
}

export class StatusActionDto {
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() note?: string;
}
