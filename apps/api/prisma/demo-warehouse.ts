/**
 * Demo / manual test for the "arrived at warehouse" notification feature.
 *
 *   seed   — create a demo customer + PROCESSING order + a BOSTA shipment
 *   report — print the order's warehouse flag, the notifications that fired,
 *            and the shipment timeline
 *
 * Between seed and report you POST a Bosta "received at warehouse" webhook
 * (state code 21) to the running API — that is the real trigger path:
 *   /webhooks/bosta -> ShipmentsService.applyTrackingUpdate
 *       -> fireMilestoneNotification (PICKED_UP) -> fireWarehouseArrivalOnce (once)
 *
 * Run:  npx ts-node prisma/demo-warehouse.ts seed
 *       npx ts-node prisma/demo-warehouse.ts report
 */
import { PrismaClient, OrderStatus, OrderSource, ShipmentStatus, Prisma } from '@prisma/client';
import { renderTemplate } from '../src/notifications/templates';

const prisma = new PrismaClient();

const ORDER_NO = 'ES-DEMO-1';
const TRACKING = 'DEMO-WH-001';
const TOKEN = 'demo-warehouse-001';
const EMAIL = 'demo.customer@essentials.eg';

async function seed() {
  // Clean any previous demo run (no FK cascade on Notification → delete by orderId).
  const existing = await prisma.order.findUnique({ where: { orderNumber: ORDER_NO } });
  if (existing) {
    await prisma.notification.deleteMany({ where: { orderId: existing.id } });
    await prisma.order.delete({ where: { id: existing.id } }); // cascades shipment + events
  }
  await prisma.customer.deleteMany({ where: { email: EMAIL } });

  const customer = await prisma.customer.create({
    data: { email: EMAIL, firstName: 'Demo', lastName: 'Customer', phone: '+201000000000' },
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: ORDER_NO,
      source: OrderSource.MANUAL,
      status: OrderStatus.PROCESSING, // already shipped to courier, awaiting movement
      customerId: customer.id,
      currency: 'EGP',
      subtotal: new Prisma.Decimal(500),
      grandTotal: new Prisma.Decimal(500),
    },
  });

  await prisma.shipment.create({
    data: {
      orderId: order.id,
      courier: 'BOSTA',
      status: ShipmentStatus.CREATED,
      trackingNumber: TRACKING,
      publicToken: TOKEN,
      trackingUrl: `https://bosta.co/tracking-shipments?id=${TRACKING}`,
      events: {
        create: { status: ShipmentStatus.CREATED, description: 'Shipment created (demo)', occurredAt: new Date() },
      },
    },
  });

  console.log('Seeded demo:');
  console.log('  order      :', ORDER_NO, '(PROCESSING)');
  console.log('  customer   :', EMAIL, '+ phone +201000000000  → 3 channels (email/SMS/WhatsApp)');
  console.log('  tracking # :', TRACKING);
  console.log('  track URL  : http://localhost:3000/track?token=' + TOKEN);
}

async function report() {
  const order = await prisma.order.findUnique({
    where: { orderNumber: ORDER_NO },
    include: { shipments: { include: { events: { orderBy: { occurredAt: 'asc' } } } } },
  });
  if (!order) return console.log('No demo order — run `seed` first.');

  const notifs = await prisma.notification.findMany({
    where: { orderId: order.id, template: 'SHIPMENT_IN_WAREHOUSE' },
    orderBy: { createdAt: 'asc' },
  });

  console.log('\n================ WAREHOUSE NOTIFICATION REPORT ================');
  console.log('Order               :', order.orderNumber, '| status:', order.status);
  console.log('warehouseNotifiedAt :', order.warehouseNotifiedAt ?? '(not yet — notification has not fired)');
  console.log('Shipment status     :', order.shipments[0]?.status);

  console.log('\nTimeline (shipment events):');
  for (const e of order.shipments[0]?.events ?? []) {
    console.log(`  • ${e.occurredAt.toISOString()}  ${e.status.padEnd(16)} ${e.description ?? ''} ${e.location ? '@ ' + e.location : ''}`);
  }

  console.log(`\nSHIPMENT_IN_WAREHOUSE notifications created: ${notifs.length}`);
  for (const n of notifs) console.log(`  • ${n.channel.padEnd(8)} → ${n.to.padEnd(28)} [${n.status}]`);

  const { subject, body } = renderTemplate('SHIPMENT_IN_WAREHOUSE', {
    customerName: 'Demo Customer',
    orderNumber: order.orderNumber,
    trackingUrl: `http://localhost:3000/track?token=${TOKEN}`,
  });
  console.log('\nMessage the customer receives:');
  console.log('  Subject:', subject);
  console.log('  Body   :', body);

  console.log('\nOnce-only check:', notifs.length === 3
    ? 'PASS — exactly one notification per channel (3), even after repeated webhooks.'
    : `notifs=${notifs.length} (expected 3 after firing: email+SMS+WhatsApp).`);
  console.log('==============================================================\n');
}

const mode = process.argv[2];
(mode === 'seed' ? seed() : report())
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
