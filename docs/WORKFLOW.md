# Order Workflow / State Machine

All transitions are enforced centrally in `OrderWorkflowService`. Illegal transitions
throw `BadRequestException`. Every transition writes an `OrderEvent`.

## Happy path

```
PENDING_REVIEW ─approve─▶ APPROVED ─push─▶ SENT_TO_ODOO ─ack─▶ PROCESSING
   ─ship─▶ SHIPPED ─deliver─▶ DELIVERED
```

## Full transition table

| From            | Allowed → To                                              | Trigger / action            |
|-----------------|-----------------------------------------------------------|-----------------------------|
| PENDING_REVIEW  | APPROVED, REJECTED, ON_HOLD, CANCELLED, PAYMENT_PENDING    | manual review               |
| PAYMENT_PENDING | PENDING_REVIEW, CANCELLED                                  | payment received / abandoned|
| APPROVED        | SENT_TO_ODOO, ON_HOLD, CANCELLED                          | Odoo push (auto on approve) |
| SENT_TO_ODOO    | PROCESSING, ON_HOLD                                       | Odoo ack / reservation      |
| PROCESSING      | SHIPPED, ON_HOLD, CANCELLED                               | Bosta shipment created      |
| SHIPPED         | DELIVERED, RETURNED                                       | Bosta webhook               |
| DELIVERED       | RETURNED                                                  | return initiated            |
| ON_HOLD         | PENDING_REVIEW, APPROVED, PROCESSING, CANCELLED           | release hold (to prior-ish) |
| REJECTED        | (terminal)                                                | —                           |
| CANCELLED       | (terminal)                                                | —                           |
| RETURNED        | (terminal)                                                | —                           |

## Side effects per transition

- **→ APPROVED**: stamp `approvedBy`/`approvedAt`; enqueue Odoo push job; notify
  customer (`ORDER_APPROVED`).
- **→ SENT_TO_ODOO**: `stock.picking` created in Odoo; store `odooPickingId`.
- **→ PROCESSING**: picking confirmed/reserved.
- **→ SHIPPED**: requires a `Shipment` with a tracking number; sync fulfillment +
  tracking back to Shopify; notify `SHIPMENT_CREATED`.
- **→ DELIVERED**: notify `DELIVERED`; close payment if COD collected.
- **→ ON_HOLD / CANCELLED / REJECTED**: capture reason; CANCELLED after Odoo push
  should also cancel the Odoo picking (`action_cancel`).

## Approval is always manual

No transition out of `PENDING_REVIEW` toward fulfillment happens automatically. A
human (Agent/Manager/Admin) must approve. Everything downstream of approval can be
automated, but shipment creation is also explicitly manual per business rule.

## Public tracking timeline (customer-facing)

The `/track` portal maps internal statuses to a friendlier timeline:

```
Order Received → Approved → Processing → Shipped → In Transit
   → Out For Delivery → Delivered
```

The mapping lives in `tracking/tracking.mapper.ts` and combines `Order.status` with
the latest `ShipmentEvent.status`.
