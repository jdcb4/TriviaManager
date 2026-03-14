# Stage 1: Install dependencies and build
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Build tools needed for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy workspace manifests + .npmrc FIRST so build scripts are allowed during install
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

# Install all dependencies (build scripts now allowed via .npmrc)
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ ./packages/

# Generate Prisma client
RUN pnpm --filter backend exec prisma generate

# Build frontend (outputs to packages/backend/public)
RUN pnpm --filter frontend build

# Build backend TypeScript
RUN pnpm --filter backend build

# Stage 2: Production image
FROM node:22-alpine AS runner
WORKDIR /app

# Copy everything needed from builder (node_modules includes Prisma engines + native binaries)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/backend/node_modules ./packages/backend/node_modules
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/backend/prisma ./packages/backend/prisma
COPY --from=builder /app/packages/backend/public ./packages/backend/public

# Copy workspace files needed for prisma CLI resolution
COPY pnpm-workspace.yaml package.json ./
COPY packages/backend/package.json ./packages/backend/

# Create downloads dir
RUN mkdir -p /app/packages/backend/public/downloads

WORKDIR /app/packages/backend

EXPOSE 3000

# Push schema to DB (creates tables if missing) then start
CMD ["sh", "-c", "node_modules/.bin/prisma db push --skip-generate --accept-data-loss && node dist/index.js"]
