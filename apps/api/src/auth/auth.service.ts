import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { LoginDto, RegisterCustomerDto } from './dto/auth.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── staff login ──────────────────────────────────────
  async loginUser(dto: LoginDto, meta: { ip?: string; userAgent?: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.issueTokens(
      { sub: user.id, role: user.role, type: 'user', email: user.email },
      { userId: user.id, ...meta },
    );
    return { user: { id: user.id, name: user.name, email: user.email, role: user.role }, ...tokens };
  }

  // ── customer login / register ────────────────────────
  async loginCustomer(dto: LoginDto, meta: { ip?: string; userAgent?: string }) {
    const customer = await this.prisma.customer.findUnique({ where: { email: dto.email } });
    if (!customer?.passwordHash || !(await argon2.verify(customer.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokens = await this.issueTokens(
      { sub: customer.id, role: Role.CUSTOMER, type: 'customer', email: customer.email ?? undefined },
      { customerId: customer.id, ...meta },
    );
    return { customer: { id: customer.id, email: customer.email }, ...tokens };
  }

  async registerCustomer(dto: RegisterCustomerDto, meta: { ip?: string; userAgent?: string }) {
    const passwordHash = await argon2.hash(dto.password);
    const customer = await this.prisma.customer.upsert({
      where: { email: dto.email },
      update: { passwordHash, firstName: dto.firstName, lastName: dto.lastName },
      create: { email: dto.email, passwordHash, firstName: dto.firstName, lastName: dto.lastName },
    });
    const tokens = await this.issueTokens(
      { sub: customer.id, role: Role.CUSTOMER, type: 'customer', email: customer.email ?? undefined },
      { customerId: customer.id, ...meta },
    );
    return { customer: { id: customer.id, email: customer.email }, ...tokens };
  }

  // ── refresh token rotation ───────────────────────────
  async refresh(rawToken: string, meta: { ip?: string; userAgent?: string }) {
    const tokenHash = this.hash(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    // rotate: revoke old, issue new
    const principal: AuthUser = stored.userId
      ? await this.userPrincipal(stored.userId)
      : await this.customerPrincipal(stored.customerId!);

    const tokens = await this.issueTokens(principal, {
      userId: stored.userId ?? undefined,
      customerId: stored.customerId ?? undefined,
      ...meta,
    });
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedBy: this.hash(tokens.refreshToken) },
    });
    return tokens;
  }

  async logout(rawToken: string) {
    const tokenHash = this.hash(rawToken);
    await this.prisma.refreshToken
      .update({ where: { tokenHash }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
    return { success: true };
  }

  // ── helpers ──────────────────────────────────────────
  private async issueTokens(
    principal: AuthUser,
    meta: { userId?: string; customerId?: string; ip?: string; userAgent?: string },
  ): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(principal, {
      secret: this.config.get('jwt.accessSecret'),
      expiresIn: this.config.get<number>('jwt.accessTtl'),
    });

    const refreshToken = randomBytes(48).toString('hex');
    const ttl = this.config.get<number>('jwt.refreshTtl')!;
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hash(refreshToken),
        userId: meta.userId,
        customerId: meta.customerId,
        expiresAt: new Date(Date.now() + ttl * 1000),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    return { accessToken, refreshToken };
  }

  private async userPrincipal(userId: string): Promise<AuthUser> {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { sub: u.id, role: u.role, type: 'user', email: u.email };
  }

  private async customerPrincipal(customerId: string): Promise<AuthUser> {
    const c = await this.prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    return { sub: c.id, role: Role.CUSTOMER, type: 'customer', email: c.email ?? undefined };
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
