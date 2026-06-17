# API Reference

Base URL: `http://localhost:4000`. Most endpoints are under `/api`; webhooks under
`/webhooks`; the public tracking portal under `/track`. Interactive docs (Swagger):
`/docs`.

Auth: `Authorization: Bearer <accessToken>` for all `/api` routes except those marked
public. Access tokens are short-lived (15m); rotate with the refresh token.

## Auth
| Method | Path | Role | Body |
|--------|------|------|------|
| POST | `/api/auth/staff/login` | public | `{ email, password }` |
| POST | `/api/auth/customer/login` | public | `{ email, password }` |
| POST | `/api/auth/customer/register` | public | `{ email, password, firstName, lastName }` |
| POST | `/api/auth/refresh` | public | `{ refreshToken }` |
| POST | `/api/auth/logout` | public | `{ refreshToken }` |

Response: `{ accessToken, refreshToken, user|customer }`.

## Users (staff)
| Method | Path | Role |
|--------|------|------|
| GET | `/api/users/me` | any staff |
| GET | `/api/users` | ADMIN |
| POST | `/api/users` | ADMIN |
| PATCH | `/api/users/:id` | ADMIN |

## Customers
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/customers?search=&page=&pageSize=` | list/search |
| GET | `/api/customers/:id` | profile + addresses + notes + orders |
| GET | `/api/customers/:id/history` | lifetime value, order count, first/last |
| POST | `/api/customers` | create |
| PATCH | `/api/customers/:id` | update |
| POST | `/api/customers/:id/addresses` | add address |
| PATCH | `/api/customers/addresses/:addressId` | update address |
| DELETE | `/api/customers/addresses/:addressId` | delete address |
| POST | `/api/customers/:id/notes` | add note |

## Orders
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/orders?status=&search=&from=&to=&page=&pageSize=` | list/filter/search |
| GET | `/api/orders/approval-queue` | pending-review queue |
| GET | `/api/orders/:id` | full order detail + events timeline |
| POST | `/api/orders` | manual order creation |
| POST | `/api/orders/:id/approve` | → APPROVED → push Odoo |
| POST | `/api/orders/:id/reject` | `{ reason }` |
| POST | `/api/orders/:id/hold` | `{ reason }` |
| POST | `/api/orders/:id/release` | release hold |
| POST | `/api/orders/:id/cancel` | `{ reason }` (cancels Odoo picking too) |
| POST | `/api/orders/:id/push-odoo` | retry Odoo push |

## Payments
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/payments/order/:orderId` | list |
| POST | `/api/payments/order/:orderId` | `{ method, amount, reference }` — record/topup |
| POST | `/api/payments/:paymentId/refund` | ADMIN/MANAGER — `{ amount, reason }` |

## Shipments (Bosta)
| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/shipments/order/:orderId` | **manually** create Bosta shipment → SHIPPED |
| GET | `/api/shipments/order/:orderId` | shipments + events |

## Odoo (inventory reads)
| Method | Path |
|--------|------|
| GET | `/api/odoo/products?q=` |
| GET | `/api/odoo/products/:sku` |
| GET | `/api/odoo/products/:sku/stock` |
| GET | `/api/odoo/warehouses` |

## Analytics (ADMIN/MANAGER)
| Method | Path |
|--------|------|
| GET | `/api/analytics/summary?from=&to=` |
| GET | `/api/analytics/revenue?from=&to=` |
| GET | `/api/analytics/top-customers` |
| GET | `/api/analytics/top-products` |

## Customer portal (CUSTOMER)
| Method | Path |
|--------|------|
| GET | `/api/portal/profile` |
| GET | `/api/portal/orders` |
| GET | `/api/portal/orders/:id` |
| GET | `/api/portal/orders/:id/invoice` |

## Public tracking
| Method | Path | Notes |
|--------|------|-------|
| GET | `/track/lookup?token=\|trackingNumber=\|orderNumber=` | timeline + history |
| GET (SSE) | `/track/:token/stream` | live updates |

## Webhooks (public, HMAC-verified)
| Method | Path | Provider |
|--------|------|----------|
| POST | `/webhooks/shopify` | Shopify — topics: orders/create, orders/updated, orders/cancelled, customers/create, customers/update |
| POST | `/webhooks/bosta` | Bosta — delivery state updates |

## Health
`GET /health` → `{ status, db, ts }`.
