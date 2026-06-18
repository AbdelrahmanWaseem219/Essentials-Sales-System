import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, raw } from 'express';
import { AppModule } from './app.module';

// Last-resort safety net: log stray async errors instead of letting Node exit.
// Nest already turns request-handler errors into HTTP 500s; these handlers stop
// an unhandled rejection / uncaught exception from a background task (poller,
// fire-and-forget send, SSE) from taking the whole server down.
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('[uncaughtException]', err);
});

// Fail fast in production if critical secrets are missing or left at dev defaults
// — a missing JWT secret would let anyone forge an admin token. Dev is unaffected.
function assertProductionSecrets() {
  if ((process.env.NODE_ENV ?? 'development') !== 'production') return;
  const problems: string[] = [];
  if (!process.env.DATABASE_URL) problems.push('DATABASE_URL');
  const acc = process.env.JWT_ACCESS_SECRET;
  const ref = process.env.JWT_REFRESH_SECRET;
  if (!acc || acc === 'dev-access' || acc.length < 16) problems.push('JWT_ACCESS_SECRET');
  if (!ref || ref === 'dev-refresh' || ref.length < 16) problems.push('JWT_REFRESH_SECRET');
  if (problems.length) {
    throw new Error(
      `Refusing to start in production: missing or weak ${problems.join(', ')}. ` +
        'Set strong, unique values in the environment.',
    );
  }
}

async function bootstrap() {
  assertProductionSecrets();
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableShutdownHooks(); // clean Prisma/Redis disconnect on SIGTERM/SIGINT

  // Webhook routes need the raw body for HMAC verification; everything else JSON.
  app.use('/webhooks', raw({ type: '*/*', limit: '5mb' }));
  app.use(json({ limit: '2mb' }));

  app.use(helmet());
  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
    credentials: true,
  });

  app.setGlobalPrefix('api', { exclude: ['webhooks/(.*)', 'track/(.*)', 'health'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Essentials Sales API')
    .setDescription('Sales Management System replacing Odoo Sales (Odoo Inventory backend)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = parseInt(process.env.PORT ?? '4000', 10);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Essentials Sales API → http://localhost:${port} (docs at /docs)`);
}
bootstrap();
