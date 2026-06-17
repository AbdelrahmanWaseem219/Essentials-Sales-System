# Data Model

Source of truth: [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma).
Products, stock and warehouses are **not** modeled here — they live in Odoo and are
referenced by `odooProductId` / SKU.

## Entities & relationships

```
User 1───* RefreshToken
User 1───* OrderEvent (actor)        User 1───* CustomerNote (author)

Customer 1───* Address
Customer 1───* Order
Customer 1───* CustomerNote
Customer 1───* RefreshToken          (customers can log into the portal)

Order *───1 Customer
Order *───1 Address (shipping)       Order *───1 Address (billing)
Order 1───* OrderItem
Order 1───* Payment 1───* Refund
Order 1───* Shipment 1───* ShipmentEvent
Order 1───* OrderEvent               (audit trail)

WebhookEvent     (raw inbound Shopify/Bosta envelopes; dedup + replay)
Notification     (email/sms/whatsapp send log)
OdooProductCache (SKU → Odoo product snapshot, TTL-refreshed)
```

## Key fields & invariants

| Model        | Field              | Notes |
|--------------|--------------------|-------|
| Order        | `orderNumber`      | unique, human-friendly `ES-#####` |
| Order        | `shopifyOrderId`   | unique → idempotent Shopify ingest |
| Order        | `odooPickingId`    | set once an outgoing delivery is created in Odoo (idempotency) |
| Order        | `status`           | transitions enforced by `OrderWorkflowService` |
| OrderItem    | `sku`              | join key to Odoo (`default_code`) |
| OrderItem    | `odooProductId`    | resolved snapshot at ingest |
| Shipment     | `publicToken`      | unguessable token for the public `/track` portal |
| Shipment     | `trackingNumber`   | unique Bosta tracking number |
| Payment      | `status`           | derived from amount vs amountPaid; COD-aware |
| WebhookEvent | `(provider,topic,externalId)` | unique → duplicate-delivery protection |

## Money

All monetary columns are `Decimal(12,2)`. Server-side arithmetic uses
`Prisma.Decimal` to avoid float drift. Default currency is `EGP`.

## Enums

`Role`, `OrderStatus`, `OrderSource`, `PaymentMethod`, `PaymentStatus`,
`ShipmentStatus`, `AddressType`, `NotificationChannel`, `NotificationStatus` —
all defined in the schema and shared with the frontend via `packages/shared`.
