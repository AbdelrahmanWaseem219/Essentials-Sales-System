import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class RecordPaymentDto {
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() reference?: string;
}

export class RefundDto {
  @IsNumber() @Min(0) amount!: number;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() reference?: string;
}
