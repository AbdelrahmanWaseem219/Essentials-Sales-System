import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, RegisterCustomerDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private meta(req: Request) {
    return { ip: req.ip, userAgent: req.headers['user-agent'] };
  }

  @Public()
  @Post('staff/login')
  staffLogin(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.loginUser(dto, this.meta(req));
  }

  @Public()
  @Post('customer/login')
  customerLogin(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.loginCustomer(dto, this.meta(req));
  }

  @Public()
  @Post('customer/register')
  customerRegister(@Body() dto: RegisterCustomerDto, @Req() req: Request) {
    return this.auth.registerCustomer(dto, this.meta(req));
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, this.meta(req));
  }

  @Public()
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }
}
