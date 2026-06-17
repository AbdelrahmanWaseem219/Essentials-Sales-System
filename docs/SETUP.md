# Setup & Usage (Windows / PowerShell)

## Prerequisites (already on your machine)
- Node v24, pnpm 9 ✓
- Docker Desktop installed ✓ (must be **running** — see Step 1)
- Dependencies installed ✓ (`pnpm install` already run)
- `.env` files created ✓ (`apps/api/.env`, `apps/web/.env.local`)

The system runs **without** Shopify/Odoo/Bosta keys for a first look — those
integrations no-op when their env vars are blank. Add keys later (Step 6).

---

## Step 1 — Start Docker Desktop
Open **Docker Desktop** from the Start menu and wait until it says "Engine running".
Verify in PowerShell:
```powershell
docker ps
```
(No error = engine is up.)

## Step 2 — Start Postgres + Redis
From the project root `D:\Abdelrahman\Essentials`:
```powershell
docker compose up -d
docker compose ps        # both services should be "running"/"healthy"
```

## Step 3 — Create the database schema
```powershell
pnpm --filter @essentials/api prisma:migrate
```
First run will ask for a migration name — type `init` and press Enter.

## Step 4 — Seed demo data (staff users + a sample order)
```powershell
pnpm --filter @essentials/api prisma:seed
```
Creates logins (password for all = `Password123!`):
- `admin@essentials.eg` (Admin)
- `manager@essentials.eg` (Sales Manager)
- `agent@essentials.eg` (Sales Agent)
- `customer@example.com` (customer portal)

## Step 5 — Run the apps (two terminals)
**Terminal A — backend:**
```powershell
pnpm --filter @essentials/api start:dev
```
→ API at http://localhost:4000, Swagger docs at http://localhost:4000/docs

**Terminal B — frontend:**
```powershell
pnpm --filter @essentials/web dev
```
→ Web at http://localhost:3000

---

## Using the system

### Admin dashboard
1. Go to http://localhost:3000 → **Staff** → log in as `admin@essentials.eg` / `Password123!`.
2. **Approval Queue** → open the seeded order `ES-10001`.
3. Click **Approve** → status moves to APPROVED (and tries to push to Odoo; with no
   Odoo configured it just logs the attempt in the order History).
4. Record a payment under the order, then **Create Bosta Shipment** when the order is
   PROCESSING (needs a Bosta key to actually call Bosta — see Step 6).

### Customer portal
http://localhost:3000/portal → log in `customer@example.com` / `Password123!` →
see orders, invoices, and a **Track** link per shipment.

### Public tracking
http://localhost:3000/track → search by order number (`ES-10001`) or tracking number.
Live updates stream in over SSE as Bosta webhooks arrive.

---

## Step 6 — Connect the real integrations (when ready)
Edit `apps/api/.env`, fill in the relevant block, then restart the backend.
See [INTEGRATIONS_SETUP.md](INTEGRATIONS_SETUP.md) for how to get each credential and
register webhooks:
- **Shopify** → `SHOPIFY_*` + register webhooks to `/webhooks/shopify`
- **Odoo** → `ODOO_*` (XML-RPC, Inventory user + API key)
- **Bosta** → `BOSTA_*` + point Bosta's webhook to `/webhooks/bosta`

To expose your local webhooks to Shopify/Bosta during testing, use a tunnel:
```powershell
# example with cloudflared or ngrok
ngrok http 4000
```
and use the public URL as the webhook address.

---

## Troubleshooting
- **`docker ps` errors** → Docker Desktop isn't running (Step 1).
- **Prisma can't connect** → containers not up (`docker compose ps`) or port 5432 in use.
- **Port 4000/3000 busy** → change `PORT` in `apps/api/.env` / run web on another port.
- **Reset everything** → `docker compose down -v` then redo Steps 2–4.
