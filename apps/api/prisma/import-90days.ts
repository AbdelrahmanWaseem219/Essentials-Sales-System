/**
 * One-time import of the last 90 days of Shopify orders, read from the saved
 * GraphQL result files (pulled via the connected Shopify MCP). Idempotent
 * (dedupe on shopifyOrderId). Historical orders are marked DELIVERED so they
 * populate history/analytics without flooding the approval queue.
 */
import { PrismaClient, OrderStatus, OrderSource, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();
const DIR = 'C:/Users/lenovo/.claude/projects/D--Abdelrahman-Essentials/55845f9c-4e4e-4ce5-912b-d66ed43351ee/tool-results';
const FILES = [
  '1781289014576', '1781289101656', '1781289131011', '1781289177608',
  '1781289248756', '1781330209041', '1781330242915',
].map((ts) => `${DIR}/mcp-78834260-7124-468f-8735-c69bcad2e2ea-graphql_query-${ts}.txt`);

const num = (gid?: string) => (gid ? gid.split('/').pop()! : undefined);
const money = (s?: any) => parseFloat(s?.shopMoney?.amount ?? '0') || 0;

function payStatus(fin: string): PaymentStatus {
  switch (fin) {
    case 'PAID': return PaymentStatus.PAID;
    case 'PARTIALLY_PAID': return PaymentStatus.PARTIALLY_PAID;
    case 'REFUNDED': return PaymentStatus.REFUNDED;
    case 'PARTIALLY_REFUNDED': return PaymentStatus.PARTIALLY_REFUNDED;
    default: return PaymentStatus.PENDING;
  }
}

async function main() {
  // Collect + dedupe order nodes across all pages.
  const nodes = new Map<string, any>();
  for (const f of FILES) {
    if (!fs.existsSync(f)) { console.warn('missing file', f); continue; }
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const e of j.data.orders.edges) nodes.set(e.node.id, e.node);
  }
  console.log(`Parsed ${nodes.size} unique orders from ${FILES.length} pages.`);

  let created = 0, skipped = 0;
  for (const o of nodes.values()) {
    const shopifyOrderId = num(o.id)!;
    if (await prisma.order.findUnique({ where: { shopifyOrderId } })) { skipped++; continue; }

    // Customer
    const c = o.customer ?? {};
    const custExt = num(c.id);
    let customer;
    if (custExt) {
      customer = await prisma.customer.upsert({
        where: { shopifyCustomerId: custExt },
        update: {},
        create: { shopifyCustomerId: custExt, email: c.email ?? undefined, phone: c.phone ?? undefined, firstName: c.firstName ?? undefined, lastName: c.lastName ?? undefined },
      });
    } else if (c.email) {
      customer = await prisma.customer.upsert({ where: { email: c.email }, update: {}, create: { email: c.email, firstName: c.firstName ?? undefined, lastName: c.lastName ?? undefined } });
    } else {
      customer = await prisma.customer.create({ data: { firstName: c.firstName ?? 'Guest', lastName: c.lastName ?? undefined, phone: c.phone ?? undefined } });
    }

    // Address
    let shippingAddressId: string | undefined;
    const sa = o.shippingAddress;
    if (sa) {
      const addr = await prisma.address.create({
        data: { customerId: customer.id, type: 'SHIPPING', firstName: sa.firstName, lastName: sa.lastName, phone: sa.phone, line1: sa.address1 ?? '—', line2: sa.address2, city: sa.city ?? '—', governorate: sa.province, country: sa.countryCodeV2 ?? 'EG', zip: sa.zip },
      });
      shippingAddressId = addr.id;
    }

    const grand = money(o.totalPriceSet);
    const ps = payStatus(o.displayFinancialStatus);
    const items = (o.lineItems?.edges ?? []).map((li: any, i: number) => {
      const price = money(li.node.originalUnitPriceSet);
      return {
        sku: (li.node.sku && li.node.sku.trim()) ? li.node.sku : `NOSKU-${o.name.replaceAll('#', '')}-${i + 1}`,
        name: li.node.title ?? '(untitled item)', quantity: li.node.quantity ?? 1,
        unitPrice: new Prisma.Decimal(price), totalPrice: new Prisma.Decimal(price * li.node.quantity),
      };
    });

    await prisma.order.create({
      data: {
        orderNumber: `ES-${o.name.replaceAll('#', '').trim()}`,
        source: OrderSource.SHOPIFY,
        status: OrderStatus.DELIVERED, // historical
        customerId: customer.id,
        shippingAddressId,
        currency: o.currencyCode ?? 'EGP',
        subtotal: new Prisma.Decimal(money(o.subtotalPriceSet)),
        shippingTotal: new Prisma.Decimal(money(o.totalShippingPriceSet)),
        discountTotal: new Prisma.Decimal(money(o.totalDiscountsSet)),
        taxTotal: new Prisma.Decimal(money(o.totalTaxSet)),
        grandTotal: new Prisma.Decimal(grand),
        shopifyOrderId, shopifyOrderName: o.name,
        placedAt: new Date(o.createdAt),
        items: { create: items },
        payments: { create: { method: PaymentMethod.CARD, status: ps, amount: new Prisma.Decimal(grand), amountPaid: ps === PaymentStatus.PAID ? new Prisma.Decimal(grand) : new Prisma.Decimal(0), currency: o.currencyCode ?? 'EGP', paidAt: ps === PaymentStatus.PAID ? new Date(o.createdAt) : null } },
        events: { create: { type: 'CREATED', message: 'Imported (90-day backfill)' } },
      },
    });
    created++;
  }
  console.log(`Imported ${created} orders, skipped ${skipped} existing.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
