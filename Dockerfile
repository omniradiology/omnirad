# ── Stage 1: Install dependencies ──
FROM node:20-alpine AS deps
WORKDIR /app

# Install build tools for native dependencies like better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy dependency manifests and scripts (for postinstall)
COPY package.json package-lock.json ./
COPY scripts/ scripts/

# Install production + dev dependencies (need dev for build)
RUN npm ci

# ── Stage 2: Build the application ──
FROM node:20-alpine AS builder
WORKDIR /app

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Run the postinstall script (patch-html2canvas)
RUN npm run postinstall 2>/dev/null || true

# Build Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: Production runner ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy the built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy database and data files if needed
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/db ./db
COPY --from=builder /app/data ./data

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
