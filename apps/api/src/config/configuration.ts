/** Centralised, typed configuration loaded from environment. */
export default () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000',

  database: {
    url: process.env.DATABASE_URL!,
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh',
    accessTtl: parseInt(process.env.JWT_ACCESS_TTL ?? '900', 10),
    refreshTtl: parseInt(process.env.JWT_REFRESH_TTL ?? '2592000', 10),
  },
  shopify: {
    shop: process.env.SHOPIFY_SHOP ?? '',
    adminToken: process.env.SHOPIFY_ADMIN_TOKEN ?? '',
    apiVersion: process.env.SHOPIFY_API_VERSION ?? '2024-07',
    webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET ?? '',
  },
  odoo: {
    url: process.env.ODOO_URL ?? '',
    db: process.env.ODOO_DB ?? '',
    username: process.env.ODOO_USERNAME ?? '',
    password: process.env.ODOO_PASSWORD ?? '',
    cacheTtl: parseInt(process.env.ODOO_CACHE_TTL ?? '300', 10),
    pollSeconds: parseInt(process.env.ODOO_POLL_SECONDS ?? '0', 10),
  },
  bosta: {
    baseUrl: process.env.BOSTA_BASE_URL ?? 'https://app.bosta.co/api/v2',
    apiKey: process.env.BOSTA_API_KEY ?? '',
    webhookSecret: process.env.BOSTA_WEBHOOK_SECRET ?? '',
    pickupAddressId: process.env.BOSTA_PICKUP_ADDRESS_ID ?? '',
    // Poll Bosta every N seconds for status changes on active shipments
    // (complements the webhook; works without a public URL). 0 disables.
    pollSeconds: parseInt(process.env.BOSTA_POLL_SECONDS ?? '0', 10),
  },
  mail: {
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM ?? 'Essentials <no-reply@essentials.eg>',
  },
  sms: {
    url: process.env.SMS_PROVIDER_URL ?? '',
    key: process.env.SMS_PROVIDER_KEY ?? '',
  },
  whatsapp: {
    url: process.env.WHATSAPP_PROVIDER_URL ?? '',
    key: process.env.WHATSAPP_PROVIDER_KEY ?? '',
  },
});

export type AppConfig = ReturnType<typeof import('./configuration').default>;
