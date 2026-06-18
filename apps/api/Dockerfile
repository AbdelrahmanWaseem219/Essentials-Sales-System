# ── build ──────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/
COPY packages ./packages
RUN pnpm install --filter @essentials/api...
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN pnpm prisma generate && pnpm build

# ── runtime ────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Copy the workspace store too: pnpm's apps/api/node_modules are symlinks into
# /app/node_modules/.pnpm, so both must be present for the app (and the local
# prisma CLI) to resolve at runtime.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
# tsconfig is needed so `prisma db seed` (ts-node prisma/seed.ts) runs with the
# project's TS settings (esModuleInterop, paths) rather than ts-node defaults.
COPY --from=build /app/apps/api/tsconfig.json ./apps/api/tsconfig.json
WORKDIR /app/apps/api
EXPOSE 4000
# Run the LOCAL prisma binary directly (no corepack/pnpm → no runtime download).
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/src/main.js"]
