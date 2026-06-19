import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type Redis from 'ioredis';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './common/prisma/prisma.service';
import { REDIS } from './common/redis/redis.module';

/** Resolve a promise but never hang: if it doesn't settle in `ms`, treat as failed. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** Lightweight liveness probe — safe for load balancers to hit frequently. */
  @Get()
  async check() {
    const db = await this.pingDb();
    return { status: db === 'ok' ? 'ok' : 'degraded', db, ts: new Date().toISOString() };
  }

  /** Richer snapshot for the human-facing /status dashboard: dependencies + live
   *  row counts. Every check is independent and failure-safe — one broken piece
   *  never takes the whole endpoint down. */
  @Get('stats')
  async stats() {
    const [db, redis, counts] = await Promise.all([
      this.pingDb(),
      this.pingRedis(),
      this.counts(),
    ]);

    const dependenciesOk = db === 'ok' && redis === 'ok';
    return {
      status: dependenciesOk ? 'ok' : 'degraded',
      db,
      redis,
      uptimeSeconds: Math.round(process.uptime()),
      counts,
      ts: new Date().toISOString(),
    };
  }

  private async pingDb(): Promise<'ok' | 'down'> {
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, 2000);
      return 'ok';
    } catch {
      return 'down';
    }
  }

  private async pingRedis(): Promise<'ok' | 'down'> {
    try {
      const pong = await withTimeout(this.redis.ping(), 2000);
      return pong === 'PONG' ? 'ok' : 'down';
    } catch {
      return 'down';
    }
  }

  /** Live business counts. Returns nulls (not zeros) if the DB is unreachable, so
   *  the dashboard can tell "no data" apart from "couldn't read". */
  private async counts() {
    try {
      const [orders, customers, shipments, unprocessedWebhooks] = await withTimeout(
        Promise.all([
          this.prisma.order.count(),
          this.prisma.customer.count(),
          this.prisma.shipment.count(),
          this.prisma.webhookEvent.count({ where: { processedAt: null } }),
        ]),
        3000,
      );
      return { orders, customers, shipments, unprocessedWebhooks };
    } catch {
      return { orders: null, customers: null, shipments: null, unprocessedWebhooks: null };
    }
  }
}
