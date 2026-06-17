import { Global, Module } from '@nestjs/common';
import { OdooClient } from './odoo.client';
import { OdooService } from './odoo.service';
import { OdooController } from './odoo.controller';

@Global()
@Module({
  controllers: [OdooController],
  providers: [OdooClient, OdooService],
  exports: [OdooService],
})
export class OdooModule {}
