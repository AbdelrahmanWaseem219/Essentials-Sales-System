/**
 * One-time import of real Shopify orders into the Sales System.
 * Data was pulled live from the ESSENTIALS EGYPT store (recent orders).
 * Idempotent: dedupes on shopifyOrderId, so re-running is safe.
 *
 * Run: pnpm --filter @essentials/api exec ts-node prisma/import-shopify.ts
 *
 * NOTE: This is a demo/bootstrap import. Ongoing sync should use the live
 * Shopify webhook pipeline (/webhooks/shopify).
 */
import { PrismaClient, OrderStatus, OrderSource, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface ImpItem { title: string; qty: number; sku?: string | null; price: number }
interface ImpOrder {
  shopifyId: string;
  name: string;
  createdAt: string;
  financial: 'PAID' | 'REFUNDED' | 'PENDING';
  total: number; subtotal: number; shipping: number; discount: number; tax: number;
  customer: { id: string; email?: string | null; phone?: string | null; first?: string; last?: string };
  ship: { first?: string; last?: string; phone?: string; line1: string; line2?: string | null; city: string; gov?: string; zip?: string | null };
  items: ImpItem[];
}

const ORDERS: ImpOrder[] = [
  { shopifyId: '6998664380738', name: '#3246', createdAt: '2026-06-09T15:24:36Z', financial: 'PAID',
    total: 3400, subtotal: 3300, shipping: 100, discount: 0, tax: 0,
    customer: { id: '9409086226754', email: null, phone: '+201148021883', first: 'Youssef', last: 'Soliman' },
    ship: { first: 'Youssef', last: 'Soliman', phone: '01148021883', line1: '14 munir sayed el far street sporting abo qeer', line2: '30', city: 'Alexandria', gov: 'Alexandria' },
    items: [{ title: 'Palm Angels T-Shirt – Monogram Spray City (Black)', qty: 1, price: 3300 }] },

  { shopifyId: '6998534324546', name: '#3245', createdAt: '2026-06-09T13:25:06Z', financial: 'PAID',
    total: 3400, subtotal: 3300, shipping: 100, discount: 0, tax: 0,
    customer: { id: '8316307734850', email: 'mazengood19@icloud.com', first: 'Mazen', last: 'Roshdy' },
    ship: { first: 'Mazen', last: 'Attia', phone: '01006195442', line1: 'التجمع الاول المجاوره الخامسه فيلا ٢٢ امام المعهد العالي للتسويق', line2: '1', city: 'New Cairo', gov: 'Cairo', zip: '2500' },
    items: [{ title: 'Essentials T-Shirt – 1977 Logo Print', qty: 1, price: 3300 }] },

  { shopifyId: '6998137143618', name: '#3244', createdAt: '2026-06-09T07:38:23Z', financial: 'PAID',
    total: 23322.64, subtotal: 23322.64, shipping: 100, discount: 5930.66, tax: 0,
    customer: { id: '8830142087490', email: 'heidihelmy84@hotmail.com', first: 'Heidi', last: 'Helmy' },
    ship: { first: 'Heidi', last: 'Helmy', phone: '01033870338', line1: 'New Giza Amberville phase one building 3b', line2: 'First floor apartment 13', city: 'Giza', gov: 'Giza' },
    items: [
      { title: 'Casablanca T-Shirt – Sunset Postcard', qty: 1, price: 3850 },
      { title: 'Casablanca T-Shirt – Sunset Arch Scene', qty: 1, price: 3740 },
      { title: 'Denim Tears Shorts – Classic Logo Patch', qty: 1, price: 3630 },
      { title: 'Ralph Lauren Shorts – Core Colors', qty: 1, price: 3388 },
      { title: 'Jordan Dri-FIT Diamond Shorts – Sport Edition', qty: 1, price: 2197.8 },
      { title: 'AMI Paris T-Shirt – Classic Red Heart Logo', qty: 1, price: 3437.5 },
      { title: 'Ralph Lauren Zip Hoodie – Grey & Black', qty: 1, price: 5280 },
      { title: 'Denim Tears Shorts – Classic Logo Patch', qty: 1, sku: '413191486', price: 3630 },
    ] },

  { shopifyId: '6998129639746', name: '#3243', createdAt: '2026-06-09T07:26:55Z', financial: 'PAID',
    total: 4400, subtotal: 4400, shipping: 100, discount: 100, tax: 0,
    customer: { id: '9193263530306', email: 'muhamedalioune6@gmail.com', first: 'Muhamed', last: 'Alioune' },
    ship: { first: 'محمد', last: 'مصطفى', phone: '01553342322', line1: 'مدينة نصر حي سفارات ١١٨ عمارات الفتح الدور الاول شقة ١٢', line2: '١١٨', city: 'القاهرة', gov: 'Cairo' },
    items: [{ title: 'Essentials Backpack – Grey Street Pack', qty: 1, price: 4400 }] },

  { shopifyId: '6997665546562', name: '#3242', createdAt: '2026-06-08T21:53:49Z', financial: 'PAID',
    total: 23279.63, subtotal: 23279.63, shipping: 100, discount: 4208.17, tax: 0,
    customer: { id: '9402164314434', email: 'rehamjad5555@gmail.com', first: 'Reham', last: 'Deraz' },
    ship: { first: 'Reham', last: 'Deraz', phone: '01050885576', line1: 'الشيخ زايد كومباوند الياسمين', line2: 'فيلا ٧٥١', city: 'الشيخ زايد', gov: 'Giza', zip: '12512' },
    items: [
      { title: 'AAPE OG Moon Face T-Shirt', qty: 1, price: 4070 },
      { title: 'BAPE ABC Camo College T-Shirt – White/Blue', qty: 1, price: 3520 },
      { title: 'Rhude Striped Nylon Shorts', qty: 1, price: 2750 },
      { title: 'Jordan Diamond Shorts – Hoops Blue', qty: 1, price: 2197.8 },
      { title: 'Sprayground Backpack – Pink Panther Shark', qty: 1, price: 14850 },
    ] },

  { shopifyId: '6996992360770', name: '#3241', createdAt: '2026-06-08T13:35:15Z', financial: 'PAID',
    total: 15147, subtotal: 15147, shipping: 100, discount: 2773, tax: 0,
    customer: { id: '9398078374210', email: 'habdelmaksoud2940@icloud.com', first: 'Helal', last: 'Maksoud' },
    ship: { first: 'Helal', last: 'Maksoud', phone: '1032130268', line1: 'sheikh zayed beverly hills westown', line2: '4-5j apartment 13 first floor', city: 'sheikh zayed', gov: '6th of October', zip: '51732' },
    items: [
      { title: 'Essentials Fear of God Sweatpants – Core Logo', qty: 1, price: 6050 },
      { title: 'Essentials Soccer Shorts – Lightweight Fit', qty: 1, price: 4400 },
      { title: 'BAPE ABC Camo College T-Shirt – White/Blue', qty: 1, price: 3520 },
      { title: 'AAPE Universe Bones T-Shirt', qty: 1, price: 3850 },
    ] },

  { shopifyId: '6996635615554', name: '#3240', createdAt: '2026-06-08T07:54:20Z', financial: 'PAID',
    total: 6322.25, subtotal: 6322.25, shipping: 100, discount: 432.75, tax: 0,
    customer: { id: '9400480923970', email: 'zeyad.elaroussi@gmail.com', first: 'Zeyad', last: 'ElAroussi' },
    ship: { first: 'Zeyad', last: 'ElAroussi', phone: '01005707055', line1: '54, bamboo extension palm hills sheikh zayed', line2: '54', city: 'Giza', gov: 'Cairo' },
    items: [
      { title: 'CDG Play T-Shirt – Red Heart Logo', qty: 1, sku: '215225215', price: 3630 },
      { title: 'Stüssy T-Shirt – Roll The Dice Pigment Dyed', qty: 1, price: 3025 },
    ] },

  { shopifyId: '6996042907970', name: '#3239', createdAt: '2026-06-07T20:03:10Z', financial: 'PAID',
    total: 17947.33, subtotal: 17947.33, shipping: 100, discount: 3267.17, tax: 0,
    customer: { id: '9399693443394', email: 'moelmadah2010@gmail.com', first: 'Sara', last: 'Raslan' },
    ship: { first: 'Sara', last: 'Raslan', phone: '01007396978', line1: 'Al rabwa', line2: 'al rabwa compound gate 5 villa 15d2', city: 'Shikhzayed', gov: 'Cairo', zip: '000' },
    items: [
      { title: 'Ralph Lauren Polo – Embroidered Slim Fit (Women)', qty: 1, price: 4477 },
      { title: 'Stussy T-Shirt – Suits Logo Black', qty: 1, price: 3520 },
      { title: 'Off-White Global Warning Flowers Tee – Black', qty: 1, price: 3437.5 },
      { title: 'Kiko Milano Double Touch Lip Color', qty: 1, price: 990 },
      { title: 'NYX Fat Oil Lip Drip – Supermodel', qty: 1, price: 990 },
      { title: 'Ralph Lauren Bear Sweater – Pink Outfit Edition', qty: 1, sku: '217103104', price: 7700 },
    ] },

  { shopifyId: '6995774308674', name: '#3238', createdAt: '2026-06-07T16:16:03Z', financial: 'PAID',
    total: 4125, subtotal: 4125, shipping: 100, discount: 100, tax: 0,
    customer: { id: '9399383818562', email: 'bassel.m.saad@gmail.com', first: 'Bassel', last: 'M. Saad' },
    ship: { first: 'Bassel', last: 'M. Saad', phone: '01002095094', line1: '13 - E Jeera', city: 'Giza', gov: '6th of October' },
    items: [{ title: 'Marcelo Burlon T-Shirt – Wings Print Black', qty: 1, price: 4125 }] },

  { shopifyId: '6993014587714', name: '#3237', createdAt: '2026-06-05T19:15:51Z', financial: 'PAID',
    total: 3858.24, subtotal: 3758.24, shipping: 100, discount: 939.56, tax: 0,
    customer: { id: '9396512129346', email: 'ahmedsamir8@gmail.com', first: 'Ahmed', last: 'Samir Kamel' },
    ship: { first: 'Ahmed', last: 'Samir Kamel', phone: '01005009901', line1: 'Villa 27B sama zayed Compound', line2: 'Sheikh Zayed', city: 'Giza', gov: 'Giza' },
    items: [
      { title: 'Jordan Dri-FIT Diamond Shorts – Breakfast Club Grey', qty: 1, price: 2500 },
      { title: 'Jordan Dri-FIT Diamond Shorts – Performance Fit', qty: 1, price: 2197.8 },
    ] },
];

function slugSku(title: string, name: string, idx: number, sku?: string | null): string {
  if (sku && sku.trim()) return sku.trim();
  // Shopify line item has no SKU — derive a stable placeholder so it can later
  // be matched/edited against Odoo's default_code.
  return `NOSKU-${name.replace('#', '')}-${idx + 1}`;
}

async function main() {
  let created = 0;
  let baseCount = await prisma.order.count();

  for (const o of ORDERS) {
    const exists = await prisma.order.findUnique({ where: { shopifyOrderId: o.shopifyId } });
    if (exists) continue;

    const customer = await prisma.customer.upsert({
      where: { shopifyCustomerId: o.customer.id },
      update: { email: o.customer.email ?? undefined, phone: o.customer.phone ?? undefined, firstName: o.customer.first, lastName: o.customer.last },
      create: {
        shopifyCustomerId: o.customer.id,
        email: o.customer.email ?? undefined,
        phone: o.customer.phone ?? undefined,
        firstName: o.customer.first,
        lastName: o.customer.last,
      },
    });

    const address = await prisma.address.create({
      data: {
        customerId: customer.id,
        type: 'SHIPPING',
        firstName: o.ship.first,
        lastName: o.ship.last,
        phone: o.ship.phone,
        line1: o.ship.line1,
        line2: o.ship.line2 ?? undefined,
        city: o.ship.city,
        governorate: o.ship.gov,
        country: 'EG',
        zip: o.ship.zip ?? undefined,
      },
    });

    const paymentStatus = o.financial === 'PAID' ? PaymentStatus.PAID : o.financial === 'REFUNDED' ? PaymentStatus.REFUNDED : PaymentStatus.PENDING;

    await prisma.order.create({
      data: {
        orderNumber: `ES-${10000 + baseCount + created + 1}`,
        source: OrderSource.SHOPIFY,
        status: OrderStatus.PENDING_REVIEW,
        customerId: customer.id,
        shippingAddressId: address.id,
        currency: 'EGP',
        subtotal: new Prisma.Decimal(o.subtotal),
        shippingTotal: new Prisma.Decimal(o.shipping),
        discountTotal: new Prisma.Decimal(o.discount),
        taxTotal: new Prisma.Decimal(o.tax),
        grandTotal: new Prisma.Decimal(o.total),
        shopifyOrderId: o.shopifyId,
        shopifyOrderName: o.name,
        placedAt: new Date(o.createdAt),
        items: {
          create: o.items.map((it, idx) => ({
            sku: slugSku(it.title, o.name, idx, it.sku),
            name: it.title,
            quantity: it.qty,
            unitPrice: new Prisma.Decimal(it.price),
            totalPrice: new Prisma.Decimal(it.price * it.qty),
          })),
        },
        payments: {
          create: {
            method: PaymentMethod.CARD,
            status: paymentStatus,
            amount: new Prisma.Decimal(o.total),
            amountPaid: paymentStatus === PaymentStatus.PAID ? new Prisma.Decimal(o.total) : new Prisma.Decimal(0),
            currency: 'EGP',
            paidAt: paymentStatus === PaymentStatus.PAID ? new Date(o.createdAt) : null,
          },
        },
        events: { create: { type: 'CREATED', message: `Imported from Shopify (${o.name})` } },
      },
    });
    created++;
  }

  console.log(`Imported ${created} new Shopify order(s). Total orders now: ${await prisma.order.count()}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
