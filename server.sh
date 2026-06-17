#!/usr/bin/env bash
#
# server.sh — one-command deploy for Essentials Sales on a Linux server (VPS).
#
# Run this ON your Ubuntu/Debian server, from the project root:
#     bash server.sh
#
# It will: install Docker (if missing) → sanity-check .env.prod →
# build & start the stack (Postgres + Redis + API + Web) → seed the admin
# user on first run → print status and the next manual steps (webhooks).
#
# Safe to re-run: redeploys with the latest code; only seeds once.
set -euo pipefail

cd "$(dirname "$0")"

COMPOSE="docker compose --env-file .env.prod -f docker-compose.prod.yml"
say() { printf '\n\033[1;36m▶ %s\033[0m\n' "$1"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

# 1) Docker present?
if ! command -v docker >/dev/null 2>&1; then
  say "Docker not found — installing..."
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required (got an old docker-compose?)."

# 2) Env file present and filled?
if [ ! -f .env.prod ]; then
  if [ -f .env.prod.example ]; then
    cp .env.prod.example .env.prod
    die ".env.prod was missing — created one from the example. Edit it (DB password, domain, secrets) then re-run."
  fi
  die ".env.prod is missing. Create it (see .env.prod.example) and re-run."
fi

# Refuse to launch with unfilled placeholders — prevents a broken/insecure deploy.
if grep -qE 'CHANGE-ME|CHANGE_ME|your-domain\.com' .env.prod; then
  grep -nE 'CHANGE-ME|CHANGE_ME|your-domain\.com' .env.prod || true
  die "The lines above in .env.prod still have placeholders. Set a strong POSTGRES_PASSWORD and your real domain, then re-run."
fi

# 3) Build & start
say "Building and starting the stack..."
$COMPOSE up -d --build

# 4) Wait for the API to report healthy
say "Waiting for the API to come up..."
for i in $(seq 1 30); do
  if $COMPOSE exec -T api wget -qO- http://localhost:4000/health >/dev/null 2>&1; then
    echo "  API is healthy."
    break
  fi
  sleep 3
  [ "$i" -eq 30 ] && die "API did not become healthy in time. Check: $COMPOSE logs api"
done

# 5) First-run admin seed (guarded by a sentinel so re-runs don't reseed)
if [ ! -f .seeded ]; then
  say "First run — seeding the admin user..."
  $COMPOSE exec -T api node_modules/.bin/prisma db seed && touch .seeded
fi

# 6) Done
DOMAIN="$(grep -E '^PUBLIC_BASE_URL=' .env.prod | cut -d= -f2-)"
printf '\n\033[1;32m✓ Deployed.\033[0m  Your app should now be live at: %s\n' "${DOMAIN:-<your domain>}"
cat <<EOF

Next (one-time) manual steps:
  1. Point your DNS A record at this server's IP (if not done).
  2. Re-point the webhooks to the new domain:
       • Shopify → ${DOMAIN}/webhooks/shopify
       • Bosta   → ${DOMAIN}/webhooks/bosta
  3. Log in and change the seeded admin password.

Useful commands:
  Logs:     $COMPOSE logs -f api
  Restart:  $COMPOSE restart
  Update:   git pull && bash server.sh
EOF
