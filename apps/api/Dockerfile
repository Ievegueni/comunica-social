FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Generate Prisma client and build
RUN pnpm --filter @comunica/api run db:generate
RUN pnpm --filter @comunica/api run build

# --- Production stage ---
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# Install all deps so prisma CLI is available
RUN HUSKY=0 pnpm install --frozen-lockfile
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
RUN cd apps/api && pnpm exec prisma generate

COPY --from=builder /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/server.js"]
