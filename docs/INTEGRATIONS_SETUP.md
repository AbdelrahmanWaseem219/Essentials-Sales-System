# Integrations Setup

## Shopify

### 1. Create a custom app
In the Shopify admin → **Settings → Apps and sales channels → Develop apps →
Create an app**. Grant Admin API scopes:
`read_orders, write_orders, read_customers, read_fulfillments, write_fulfillments`.
Install it and copy the **Admin API access token** → `SHOPIFY_ADMIN_TOKEN`.
The app's **API secret** → `SHOPIFY_WEBHOOK_SECRET` (used for HMAC verification).

### 2. Register webhooks
Point all topics at `https://<your-host>/webhooks/shopify`:

```bash
TOKEN=$SHOPIFY_ADMIN_TOKEN
SHOP=$SHOPIFY_SHOP
ADDR="https://your-host/webhooks/shopify"
for TOPIC in orders/create orders/updated orders/cancelled customers/create customers/update; do
  curl -s -X POST "https://$SHOP/admin/api/2024-07/webhooks.json" \
    -H "X-Shopify-Access-Token: $TOKEN" -H "Content-Type: application/json" \
    -d "{\"webhook\":{\"topic\":\"$TOPIC\",\"address\":\"$ADDR\",\"format\":\"json\"}}"
done
```

Shopify signs each delivery with `X-Shopify-Hmac-Sha256`; the controller verifies it
against the **raw** request body (configured in `main.ts`). Invalid signatures are
recorded but not processed.

### 3. Idempotency
Each delivery is deduped on `(provider, topic, X-Shopify-Webhook-Id)` in
`WebhookEvent`. Orders dedupe again on `shopifyOrderId`, so replays are safe.

## Odoo (Inventory only)

1. Create an integration user in Odoo with access to Inventory.
2. Generate an API key (Preferences → Account Security) → `ODOO_PASSWORD`.
3. Set `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`.
4. No addon needed — XML-RPC (`/xmlrpc/2/common`, `/xmlrpc/2/object`) is built in.

Test connectivity: `GET /api/odoo/warehouses` (as staff) should list warehouses.
See [ODOO_INTEGRATION.md](ODOO_INTEGRATION.md) for the order-to-delivery design.

## Bosta

1. Get an API key from the Bosta dashboard → `BOSTA_API_KEY`.
2. Configure the delivery webhook in Bosta to POST to
   `https://<your-host>/webhooks/bosta`. If Bosta supports a shared secret, set it
   on both sides via `BOSTA_WEBHOOK_SECRET` (sent as `x-webhook-secret`).
3. Shipment creation is **manual** from the order detail screen
   (`POST /api/shipments/order/:orderId`). The tracking number is synced back to
   the Shopify order as a fulfillment.

Status codes are mapped in `integrations/bosta/bosta.mapper.ts`; adjust if your
Bosta account uses different state codes.
