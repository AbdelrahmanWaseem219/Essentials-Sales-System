import { PrismaClient, Role, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  // ── Staff users (one per role) ──────────────────────
  const password = await argon2.hash('Password123!');
  const staff: { email: string; name: string; role: Role }[] = [
    { email: 'admin@essentials.eg', name: 'Admin', role: Role.ADMIN },
    { email: 'manager@essentials.eg', name: 'Sales Manager', role: Role.SALES_MANAGER },
    { email: 'agent@essentials.eg', name: 'Sales Agent', role: Role.SALES_AGENT },
  ];
  for (const u of staff) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role },
      create: { ...u, passwordHash: password },
    });
  }

  // ── Demo customer with portal login ─────────────────
  const customer = await prisma.customer.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      email: 'customer@example.com',
      passwordHash: password,
      firstName: 'Mona',
      lastName: 'Hassan',
      phone: '+201000000000',
      addresses: {
        create: {
          type: 'SHIPPING',
          isDefault: true,
          line1: '12 Tahrir St',
          city: 'Cairo',
          governorate: 'Cairo',
          country: 'EG',
        },
      },
    },
    include: { addresses: true },
  });

  // ── Demo order ──────────────────────────────────────
  const exists = await prisma.order.findFirst({ where: { customerId: customer.id } });
  if (!exists) {
    await prisma.order.create({
      data: {
        orderNumber: 'ES-10001',
        source: 'MANUAL',
        status: OrderStatus.PENDING_REVIEW,
        customerId: customer.id,
        shippingAddressId: customer.addresses[0]?.id,
        currency: 'EGP',
        subtotal: 450,
        shippingTotal: 50,
        grandTotal: 500,
        items: {
          create: [
            { sku: 'SKU-001', name: 'Cotton T-Shirt', quantity: 2, unitPrice: 150, totalPrice: 300 },
            { sku: 'SKU-002', name: 'Canvas Tote Bag', quantity: 1, unitPrice: 150, totalPrice: 150 },
          ],
        },
        payments: {
          create: { method: PaymentMethod.COD, status: PaymentStatus.PENDING, amount: 500, currency: 'EGP' },
        },
        events: { create: { type: 'CREATED', message: 'Seed order' } },
      },
    });
  }

  // Order-number counter (atomic sequence). Start above any existing ES-100xx.
  await prisma.counter.upsert({
    where: { id: 'orderNumber' },
    update: {},
    create: { id: 'orderNumber', value: 10100 },
  });

  // eslint-disable-next-line no-console
  console.log('Seed complete. Staff password: Password123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
