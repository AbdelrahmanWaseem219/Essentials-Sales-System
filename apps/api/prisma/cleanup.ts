/**
 * Wipe all test/demo ORDER + CUSTOMER data for a clean go-live slate.
 * Keeps: staff Users, Counter (reset), Odoo product cache.
 * Order deletes cascade to items/payments/refunds/shipments/events.
 *
 * Run:  pnpm --filter @essentials/api exec ts-node prisma/cleanup.ts
 *
 * NOTE: This does NOT touch Odoo or Bosta — cancel any test pickings in Odoo
 * and any test waybills in Bosta separately.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Destructive: wipes ALL orders AND customers. Guard against accidental runs.
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run cleanup in production (NODE_ENV=production).');
    process.exit(1);
  }
  if (process.env.CONFIRM_WIPE !== 'YES') {
    console.error(
      'Refusing to wipe. This deletes ALL orders and ALL customers (incl. portal accounts).\n' +
        'If you are sure, re-run with CONFIRM_WIPE=YES set in the environment.',
    );
    process.exit(1);
  }

  const orders = await prisma.order.deleteMany({}); // cascades items/payments/shipments/events
  const webhooks = await prisma.webhookEvent.deleteMany({});
  const notifs = await prisma.notification.deleteMany({});
  const notes = await prisma.customerNote.deleteMany({});
  const addresses = await prisma.address.deleteMany({});
  const customers = await prisma.customer.deleteMany({}); // cascades their refresh tokens

  // Reset the order-number sequence so the first live order is ES-10101.
  await prisma.counter.upsert({
    where: { id: 'orderNumber' },
    update: { value: 10100 },
    create: { id: 'orderNumber', value: 10100 },
  });

  console.log(
    `Cleaned: ${orders.count} orders, ${customers.count} customers, ${addresses.count} addresses, ` +
      `${webhooks.count} webhook events, ${notifs.count} notifications, ${notes.count} notes. ` +
      `Next order number: ES-10101. Staff logins kept.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
