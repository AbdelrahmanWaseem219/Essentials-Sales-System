# Essentials Sales System

A custom **Sales Management System** for **Essentials Egypt**.

It runs the whole sales side of the business — orders, customers, approvals,
payments, shipments and customer tracking — and connects to **Shopify** (where
orders come in), **Odoo Inventory** (stock backend) and **Bosta** (courier).

> It replaces Odoo's paid **Sales** module. Odoo is used **only** for inventory.

---

## What it does

- 📥 **Imports orders & customers from Shopify** automatically (webhooks)
- ✅ **Manual approval workflow** — review an order, then approve it
- 📦 **Pushes approved orders to Odoo Inventory** as stock moves / deliveries
- 🚚 **Creates Bosta shipments** and tracks them
- 🔔 **Notifies customers** by Email / SMS / WhatsApp at each step
  (incl. an "arrived at our warehouse" update)
- 🌐 **Public tracking page** at `/track` — live order status for customers
- 👤 **Customer portal** — customers see their orders & invoices
- 📊 **Admin dashboard** — orders, customers, payments, analytics
- 🌙 **Light / dark mode**, fully responsive (phone, tablet, desktop)

## Order flow

```
Shopify order  →  Pending review  →  Approved  →  Pushed to Odoo
   →  Warehouse packs & validates delivery  →  Bosta shipment created
   →  Shipped  →  In transit  →  Out for delivery  →  Delivered
```

The customer can follow this live on the tracking page, and gets notified at
the key steps.

---

## Tech stack

| Part | Tech |
|------|------|
| Frontend | Next.js 14, React, Tailwind CSS |
| Backend | NestJS (Node.js), Prisma |
| Database | PostgreSQL + Redis |
| Integrations | Shopify (webhooks), Odoo Inventory (XML-RPC), Bosta (API) |

## Project layout

```
apps/
  api/     →  Backend (NestJS) — runs on http://localhost:4000
  web/     →  Frontend (Next.js) — runs on http://localhost:3000
packages/
  shared/  →  Shared TypeScript types
docs/      →  Detailed docs (architecture, data model, API, workflow)
```

---

## Running it locally

You need **Docker Desktop** running (for the database) and **Node.js**.

```bash
# 1. Install dependencies
pnpm install

# 2. Start the database + cache
docker compose up -d

# 3. Set up the database (first time only)
pnpm --filter @essentials/api prisma:migrate

# 4. Start the backend  → http://localhost:4000
pnpm --filter @essentials/api start:dev

# 5. Start the frontend → http://localhost:3000
pnpm --filter @essentials/web dev
```

Then open:

- **Site:** http://localhost:3000
- **Staff login:** http://localhost:3000/login
- **Track an order:** http://localhost:3000/track
- **API docs (Swagger):** http://localhost:4000/docs

> Secrets (database, Shopify, Odoo, Bosta, email) live in `apps/api/.env`.
> A production template is in `apps/api/.env.production`.

---

## Status

The system is **built and working**. Before going fully live it still needs:
notification credentials (email/SMS), and a **server + domain** to deploy to.
See [docs/DEPLOY.md](docs/DEPLOY.md) for deployment steps.

More detail in [`docs/`](docs/): architecture, data model, the Odoo
integration, the order workflow, and the API reference.
