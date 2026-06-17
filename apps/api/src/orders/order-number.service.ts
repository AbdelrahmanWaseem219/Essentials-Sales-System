import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

const COUNTER_ID = 'orderNumber';
const BASE = 10100; // starts above any seeded/imported ES-100xx numbers

/**
 * Generates unique, human-friendly order numbers (ES-#####) using an atomic
 * counter increment, so concurrent webhooks/backfill can never mint duplicates.
 * Replaces the old `count()+1` scheme (which raced).
 */
@Injectable()
export class OrderNumberService {
  constructor(private readonly prisma: PrismaService) {}

  async next(): Promise<string> {
    // A single UPDATE ... RETURNING is atomic; each caller gets a distinct value.
    const counter = await this.prisma.counter.upsert({
      where: { id: COUNTER_ID },
      create: { id: COUNTER_ID, value: BASE + 1 },
      update: { value: { increment: 1 } },
    });
    return `ES-${counter.value}`;
  }
}
