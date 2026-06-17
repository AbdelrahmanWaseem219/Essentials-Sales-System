# Deploy — make it live 24/7

Goal: move off your laptop + temporary ngrok URL onto an always-on server with a
**permanent web address**, so orders, Odoo polling, and webhooks keep working even
when your PC is off.

Everything is already containerized:
- `apps/api/Dockerfile`, `apps/web/Dockerfile`
- `docker-compose.prod.yml` (Postgres + Redis + API + Web in one stack)
- `.env.prod.example` (copy to `.env.prod`, fill in secrets)

You need two things I can't create for you: **a small server** and **a domain/subdomain**.

---

## Recommended path — a $5 VPS + Cloudflare (simplest always-on)

### 1. Get a server
Create a cheap VPS (e.g. Hetzner CPX11 ~€4/mo, or DigitalOcean $6/mo droplet), Ubuntu 22.04+.
Note its public IP.

### 2. Point a domain at it
In your DNS (e.g. Cloudflare, free), add an **A record**:
`sales.essentials-egy.com → <server IP>` (proxied/orange-cloud = free HTTPS).

### 3. Install Docker on the server
```bash
curl -fsSL https://get.docker.com | sh
```

### 4. Copy the project up and configure
```bash
# from your PC (or git clone on the server)
scp -r ./Essentials  root@<server-ip>:/opt/essentials
ssh root@<server-ip>
cd /opt/essentials
cp .env.prod.example .env.prod
nano .env.prod        # fill in passwords, JWT secrets, Shopify/Odoo/Bosta keys,
                      # and set CORS_ORIGIN / PUBLIC_BASE_URL to https://sales.essentials-egy.com
```

### 5. Launch
```bash
# --env-file is REQUIRED: it lets Compose interpolate ${POSTGRES_*} in the file.
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build

# Seed the first admin user + demo data (first time only):
docker compose --env-file .env.prod -f docker-compose.prod.yml \
  exec api node_modules/.bin/prisma db seed
```
The API auto-runs `prisma migrate deploy` on start (see apps/api/Dockerfile), so you
only need the explicit seed once.

Your app is now live at **https://sales.essentials-egy.com** (Cloudflare handles HTTPS).

### 6. Re-point the webhooks (one time, permanent)
Update these to the new domain (replace the old ngrok URL):
- **Shopify** → Settings → Notifications → each webhook → `https://sales.essentials-egy.com/webhooks/shopify`
- **Bosta** → webhook URL → `https://sales.essentials-egy.com/webhooks/bosta`

Because the domain never changes, you'll never have to touch these again.

### 7. Done — it stays up
`restart: always` means the stack auto-restarts on crash or server reboot. You can
close your laptop; the system keeps running.

---

## Alternative — managed PaaS (no server admin)

If you'd rather not manage a VPS, **Railway** or **Render** can build these Dockerfiles
from a GitHub repo and give managed Postgres + Redis + a URL:
1. Push this project to a private GitHub repo.
2. Create a Railway/Render project → add Postgres + Redis plugins.
3. Add two services from the repo (api Dockerfile, web Dockerfile) + the env vars.
4. Use the generated public URL for the webhooks (step 6 above).

Slightly more per month, zero server maintenance.

---

## Operating notes
- **Backups:** the Postgres data lives in the `pgdata` volume — set up a daily
  `pg_dump` (or use the host provider's snapshots).
- **Logs:** `docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f api`
- **Update/redeploy:** `git pull && docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build`
- **Tip:** if you'd rather not type `--env-file` each time, copy `.env.prod` to `.env`
  (Compose auto-loads a file literally named `.env` for interpolation).
- **Secrets:** never commit `.env.prod` (it's git-ignored).
