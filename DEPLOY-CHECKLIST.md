# Deploy checklist — Essentials Sales

A short, do-it-in-order list to take the system live. Full detail in
[docs/DEPLOY.md](docs/DEPLOY.md).

## Before you start (gather these)
- [ ] A Linux server (VPS), Ubuntu 22.04+ — note its public IP
- [ ] A domain/subdomain, e.g. `sales.essentials-egy.com`
- [ ] (Optional, for emails) Gmail App Password for `egyessentials@gmail.com`

## 1. Point the domain
- [ ] In DNS (Cloudflare = free HTTPS), add an **A record**:
      `sales.essentials-egy.com → <server IP>` (proxied / orange cloud)

## 2. Prep the server
- [ ] `ssh root@<server-ip>`
- [ ] Install Docker: `curl -fsSL https://get.docker.com | sh`

## 3. Upload the project
- [ ] From your PC: `scp -r ./Essentials root@<server-ip>:/opt/essentials`
      (or `git clone` on the server)

## 4. Finish the env file
- [ ] `cd /opt/essentials`
- [ ] Edit `.env.prod` and set the 3 marked lines:
  - [ ] `POSTGRES_PASSWORD` → a strong password
  - [ ] `CORS_ORIGIN` and `PUBLIC_BASE_URL` → `https://sales.essentials-egy.com`
  - [ ] `SMTP_PASS` → Gmail App Password (only if sending emails now)
  - (JWT secrets + Odoo/Bosta/Shopify keys are already filled in.)

## 5. Launch
- [ ] `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build`
- [ ] First time only — create the admin login:
      `docker compose --env-file .env.prod -f docker-compose.prod.yml exec api node_modules/.bin/prisma db seed`
- [ ] Open `https://sales.essentials-egy.com` — site loads
- [ ] Log in, then change the seeded admin password

## 6. Re-point webhooks (permanent — never changes again)
- [ ] **Shopify** → each webhook → `https://sales.essentials-egy.com/webhooks/shopify`
- [ ] **Bosta** → webhook URL → `https://sales.essentials-egy.com/webhooks/bosta`

## 7. Smoke test (end to end)
- [ ] Place a real test order in Shopify → it appears in the admin
- [ ] Approve it → pushes to Odoo
- [ ] Validate the Odoo delivery → Bosta shipment created → order goes SHIPPED
- [ ] Open the customer's `/track` link → status updates
- [ ] Confirm the email/SMS arrived (if notifications configured)
- [ ] Cancel the test Bosta waybill afterwards

## 8. Operate
- [ ] Backups: enable provider snapshots or a nightly `pg_dump`
- [ ] Logs: `docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f api`
- [ ] Update later: `git pull && docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build`

> The stack uses `restart: always`, so it survives crashes and reboots — your PC
> can be off and the system keeps running.
