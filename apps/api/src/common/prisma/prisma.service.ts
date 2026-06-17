import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // Retry the initial DB connection so a momentarily-unavailable database
    // (Docker/Postgres still starting, a brief network blip) doesn't crash the
    // whole API at boot. After the retries we deliberately do NOT rethrow —
    // Prisma reconnects lazily on the next query once the DB is reachable, so the
    // process stays alive and self-heals instead of exiting.
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        await this.$connect();
        return;
      } catch (e: any) {
        this.logger.warn(
          `DB connect attempt ${attempt}/10 failed: ${e.message}. Retrying in 3s…`,
        );
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    this.logger.error(
      'Could not connect to the database after 10 attempts; staying up and will reconnect on demand.',
    );
  }

  async onModuleDestroy() {
    await this.$disconnect().catch(() => undefined);
  }
}
