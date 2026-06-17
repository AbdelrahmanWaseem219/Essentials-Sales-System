# Architecture

## 1. Overview

The Essentials Sales System is a **system of record for sales operations**. Odoo
remains the system of record for **inventory** (products, stock, warehouses). The
two are kept consistent through a one-way-read / one-way-write integration:

- **Read** from Odoo: product catalog, stock availability, warehouse info.
- **Write** to Odoo: approved orders become inventory **stock moves / deliveries**
  (NOT sales orders), so stock is decremented without touching the Sales module.

```
                       ┌────────────────────────────────────────────┐
                       │              Essentials Sales System          │
                       │                                              │
  Shopify ──webhooks──▶│  Ingestion  ─▶  Orders  ─▶  Workflow Engine  │──▶ Odoo Inventory
                       │      │           │              │            │     (XML-RPC: stock.move,
  Bosta  ◀──REST──────▶│  Shipments  ◀────┘              ▼            │      stock.picking)
   ▲   webhooks        │      │                    Notifications      │
   └────updates────────│      │                  (Email/SMS/WhatsApp) │◀── Odoo (read: product,
                       │      ▼                                       │     stock.quant, warehouse)
   Customers ◀─────────│  Customer Portal  /  Public /track portal    │
                       └────────────────────────────────────────────┘
```

## 2. Technology

| Layer        | Choice                                            |
|--------------|---------------------------------------------------|
| Frontend     | Next.js 14 (App Router), TypeScript, Tailwind, shadcn/ui |
| Backend      | NestJS, TypeScript                                |
| Database     | PostgreSQL 16 + Prisma ORM                        |
| Cache/Queue  | Redis + BullMQ (async jobs, webhooks, retries)    |
| Realtime     | Server-Sent Events (tracking) + WebSocket gateway |
| Auth         | JWT access tokens + rotating refresh tokens, RBAC |

## 3. Backend module map (NestJS)

```
apps/api/src/
├─ main.ts                      bootstrap, Swagger, validation, helmet
├─ app.module.ts
├─ common/                      guards, decorators, interceptors, prisma, redis
│  ├─ prisma/                   PrismaService
│  ├─ auth guards/decorators    JwtAuthGuard, RolesGuard, @Roles, @CurrentUser
│  └─ filters/                  global exception filter
├─ config/                      typed env config
├─ auth/                        login, refresh, logout, password
├─ users/                       internal users (Admin/Manager/Agent)
├─ customers/                   profiles, addresses, notes, history
├─ orders/                      CRUD + search/filter + approval actions
│  └─ workflow/                 OrderWorkflowService (state machine)
├─ payments/                    COD, paid, partial, refunds, status
├─ shipments/                   Bosta shipment lifecycle
├─ integrations/
│  ├─ shopify/                  webhook controller + HMAC + importer service
│  ├─ odoo/                     XML-RPC client + inventory service
│  └─ bosta/                    REST client + shipment service
├─ notifications/               channel adapters (email/sms/whatsapp) + dispatcher
├─ analytics/                   revenue, orders, top customers/products, returns
├─ tracking/                    PUBLIC tracking endpoints + SSE stream
└─ jobs/                        BullMQ processors (webhooks, odoo sync, notifications)
```

## 4. Key design decisions

### 4.1 Orders are owned here, not in Odoo
Shopify orders are ingested into our `Order` table. Odoo never sees an order until
it is **manually approved**. On approval the workflow engine creates an outbound
**delivery / stock move** in Odoo to decrement inventory. This keeps Odoo Sales
entirely out of the loop (see [ODOO_INTEGRATION.md](ODOO_INTEGRATION.md)).

### 4.2 Idempotent, replayable integration
Every inbound webhook (Shopify, Bosta) is:
1. HMAC-verified at the edge.
2. Persisted raw into `WebhookEvent` (dedup on provider event id).
3. Enqueued to BullMQ and processed by a worker with retry/backoff.

This makes ingestion crash-safe and replayable, and protects against duplicate
deliveries.

### 4.3 Explicit order state machine
Order status transitions are centralized in `OrderWorkflowService`. Illegal
transitions throw. Every transition writes an `OrderEvent` (audit trail) and may
trigger side effects (Odoo push, notification, shipment readiness).

### 4.4 SKU is the product join key
Odoo products and Shopify line items are matched by **SKU** (`default_code` in
Odoo). Orders store a snapshot of the resolved Odoo product id + SKU so later Odoo
catalog edits don't rewrite history.

### 4.5 RBAC
Four roles — `ADMIN`, `SALES_MANAGER`, `SALES_AGENT`, `CUSTOMER`. Guarded by a
`RolesGuard` reading `@Roles(...)` metadata. Customers are authenticated against
the `Customer` table; staff against `User`.

## 5. Data flow: a Shopify order to delivered

1. `orders/create` webhook → verified → `WebhookEvent` row → job queued.
2. Worker upserts `Customer` + `Order` (status `PENDING_REVIEW`) + `OrderItem`s
   (SKU resolved against Odoo), `Payment` (COD/paid).
3. Sales agent reviews in admin dashboard → **Approve**.
4. Workflow → `APPROVED` → enqueues Odoo push → creates `stock.picking`
   (outgoing) in Odoo → status `SENT_TO_ODOO` → `PROCESSING`.
5. Agent **creates Bosta shipment** (manual) → tracking number stored, synced back
   to Shopify fulfillment → status `SHIPPED`.
6. Bosta webhooks update `ShipmentEvent`s → timeline → status `DELIVERED`.
7. Each milestone fires customer notifications and updates the public `/track` page
   over SSE.

## 6. Deployment

- API and web are independently deployable (Docker images).
- Stateless API; sessions/refresh tokens in Postgres, ephemeral state in Redis.
- Horizontal scale: multiple API replicas + dedicated worker replicas consuming the
  same BullMQ queues.
