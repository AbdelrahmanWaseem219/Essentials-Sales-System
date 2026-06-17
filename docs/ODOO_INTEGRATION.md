# Odoo Integration — Inventory only (no Sales / CRM / Quotations)

## Goal

Use Odoo **Inventory** as the stock backend without touching the paid Sales module.
That means we never create `sale.order` / `sale.order.line` records, never use CRM,
and never generate quotations. We only:

1. **Read** the product catalog, stock availability, and warehouses.
2. **Write** approved orders as outgoing **stock movements** (deliveries).

## Why this works

In Odoo, the Sales module is just one of several documents that *generate* stock
moves. Inventory itself owns the models that actually move stock:

| Concern              | Odoo model            | We use it for           |
|----------------------|-----------------------|-------------------------|
| Product              | `product.product` / `product.template` | read catalog, match by `default_code` (SKU) |
| On-hand stock        | `stock.quant`         | read available qty per location |
| Warehouse            | `stock.warehouse`     | read warehouse + its delivery operation type |
| Locations            | `stock.location`      | source (stock) → dest (customer) |
| Operation type       | `stock.picking.type`  | the "Delivery Orders" operation of the warehouse |
| Delivery document    | `stock.picking`       | the outbound order we create on approval |
| Move line            | `stock.move`          | one per order line |
| Partner (customer)   | `res.partner`         | recipient of the delivery (created/matched, NOT a CRM lead) |

A `stock.picking` of type *outgoing* with moves from the internal stock location to
the customer location decrements inventory exactly the way a confirmed sale order
would have — but entirely within the Inventory app.

## Transport

Odoo Community exposes XML-RPC out of the box:

- `/xmlrpc/2/common` → `authenticate(db, user, password, {})` → returns `uid`
- `/xmlrpc/2/object` → `execute_kw(db, uid, password, model, method, args, kwargs)`

No extra Odoo addon required. (JSON-RPC `/web/dataset/call_kw` is an alternative; we
use XML-RPC for portability.)

## Read flows

### Products / SKU resolution
```
execute_kw('product.product', 'search_read',
  [[['default_code', '=', sku]]],
  { fields: ['id', 'name', 'default_code', 'list_price', 'qty_available'], limit: 1 })
```
Results are cached in `OdooProductCache` (TTL configurable) so order ingestion and
the dashboard don't hammer Odoo.

### Stock availability
`qty_available` on `product.product` gives free-to-promise per the product's
configured warehouse. For per-warehouse granularity read `stock.quant`:
```
execute_kw('stock.quant', 'read_group',
  [[['product_id', '=', pid], ['location_id.usage', '=', 'internal']]],
  ['quantity:sum'], ['location_id'])
```

### Warehouses
```
execute_kw('stock.warehouse', 'search_read', [[]],
  { fields: ['id', 'name', 'code', 'lot_stock_id', 'out_type_id'] })
```
`out_type_id` is the warehouse's outgoing `stock.picking.type` — exactly what we set
on the delivery we create.

## Write flow: approved order → outgoing delivery

On approval (`OrderWorkflowService` → `SENT_TO_ODOO`):

1. **Resolve / create the partner**
   ```
   partner_id = search res.partner by phone/email/shopify ref
              ?? create res.partner { name, phone, email, street, city, ... }
   ```
   (A `res.partner` is shared by Contacts/Inventory; creating one does NOT require
   Sales or CRM.)

2. **Resolve warehouse operation + locations**
   - `picking_type_id` = warehouse `out_type_id`
   - `location_id`      = `picking_type.default_location_src_id` (internal stock)
   - `location_dest_id` = the customer location (`stock.location` usage `customer`)

3. **Create the picking with its moves** in one call:
   ```
   stock.picking.create({
     partner_id, picking_type_id, location_id, location_dest_id,
     origin: orderNumber,                     // traceability back to our order
     move_ids_without_package: [
       (0, 0, { name, product_id, product_uom_qty, product_uom,
                location_id, location_dest_id }) for each line
     ]
   })
   ```

4. **Confirm + reserve**: call `action_confirm` then `action_assign` on the picking
   so Odoo reserves stock. (Validation / `button_validate` is left manual in Odoo, or
   automated later, depending on warehouse SOP.)

5. Store `odooPickingId` + `odooPushedAt` on the `Order`, advance status to
   `PROCESSING`, and write an `OrderEvent` of type `ODOO_PUSH`.

If any step fails the job is retried with backoff; the order stays `APPROVED` and the
error is recorded on the `OrderEvent` so an agent can intervene.

## Idempotency

Before creating a picking we check `Order.odooPickingId`. If set, we skip. We also set
`origin = orderNumber`, so a manual reconciliation can find the picking by our order
number. Optionally search `stock.picking` by `origin` to recover from a lost write.

## What we explicitly avoid
- `sale.order`, `sale.order.line` — never created.
- `crm.lead` — never touched.
- No quotation PDF / confirmation emails from Odoo (we own customer comms).
