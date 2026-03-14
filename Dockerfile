# Stage 1: Install dependencies and build
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifests
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ ./packages/
COPY .npmrc ./

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

# Run migrations then start
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/index.js"]
