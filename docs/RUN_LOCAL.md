# Run it locally (until you get a server)

## Every time you want to use it

1. Open **Docker Desktop** and wait for "Engine running".
2. Double-click **`start.bat`** (in the project folder `D:\Abdelrahman\Essentials`).
   - It starts the database, the API, and the web app, then opens
     **http://localhost:3000** in your browser.
   - Two black windows ("Essentials API" and "Essentials Web") will open — **leave
     them open** while you work. They're the running servers.
3. Log in: `admin@essentials.eg` / `Password123!`

## When you're done
Double-click **`stop.bat`** (or just close the two black windows). Your data is kept
safely in the database — nothing is lost.

## What works locally vs. what doesn't

| Works on localhost | Needs the server (later) |
|---|---|
| Dashboard, orders, customers, analytics | New Shopify orders syncing **automatically** |
| Approving orders → push to Odoo | Customers reaching `/track` from outside your network |
| Validate in Odoo → auto Bosta shipment (poller) | Anyone but you using the system |
| Creating Bosta shipments | |

> **About automatic Shopify sync while local:** Shopify can only send new orders to a
> *public* address. On your laptop that means running a tunnel (`start-tunnel.bat`),
> but the free tunnel URL changes each time, so you'd have to re-paste it into
> Shopify/Bosta. For day-to-day local use this is fine to skip — when you're ready
> for it to "just work" 24/7, deploy to a server (see **DEPLOY.md**).

## If something won't start
- **"Docker isn't running"** → open Docker Desktop first.
- **Port already in use** → an old server is still running; run `stop.bat`, then `start.bat`.
- Still stuck → close all black windows, run `stop.bat`, then `start.bat`.
