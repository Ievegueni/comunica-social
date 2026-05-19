FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN HUSKY=0 pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/

# Build
RUN pnpm --filter @comunica/web run build

# --- Production stage ---
FROM node:20-alpine AS runner

RUN npm install -g serve

COPY --from=builder /app/apps/web/dist /app/dist

WORKDIR /app

EXPOSE 3000

CMD ["serve", "dist", "-s", "-l", "3000"]
