/**
 * Targeted cleanup of the manual demo/test data created while testing the
 * warehouse-notification feature. Removes ONLY the demo order + demo customer
 * (and their cascaded shipment/items/payments/events/notifications). Leaves the
 * 345 imported historical orders untouched.
 *
 * Run:  npx ts-node prisma/cleanup-demo.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ORDER_NO = 'ES-DEMO-1';
const EMAIL = 'demo.customer@essentials.eg';

async function main() {
  const before = {
    orders: await prisma.order.count(),
    customers: await prisma.customer.count(),
    shipments: await prisma.shipment.count(),
  };

  const order = await prisma.order.findUnique({ where: { orderNumber: ORDER_NO } });
  if (order) {
    await prisma.notification.deleteMany({ where: { orderId: order.id } }); // no FK cascade
    await prisma.order.delete({ where: { id: order.id } }); // cascades shipment/items/payments/events
    console.log(`Deleted order ${ORDER_NO} (+ shipment, events, notifications).`);
  } else {
    console.log(`No order ${ORDER_NO} found (already clean).`);
  }

  const customer = await prisma.customer.findUnique({ where: { email: EMAIL } });
  if (customer) {
    await prisma.notification.deleteMany({ where: { customerId: customer.id } });
    await prisma.customerNote.deleteMany({ where: { customerId: customer.id } });
    await prisma.address.deleteMany({ where: { customerId: customer.id } });
    await prisma.customer.delete({ where: { id: customer.id } }); // cascades refresh tokens
    console.log(`Deleted demo customer ${EMAIL}.`);
  } else {
    console.log(`No demo customer ${EMAIL} found (already clean).`);
  }

  const after = {
    orders: await prisma.order.count(),
    customers: await prisma.customer.count(),
    shipments: await prisma.shipment.count(),
  };
  console.log('\nBefore:', before);
  console.log('After :', after);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
