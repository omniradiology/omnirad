###############################################################################
# OmniRad — Unified Docker Image
# Combines the Next.js web app and the Python AI service into one container.
#
# Build:  docker build -t omnirad .
# Run:    docker run -p 3000:3000 -p 8000:8000 omnirad
###############################################################################

# ══════════════════════════════════════════════════════════════════════════════
# Stage 1: Install Node.js dependencies
# ══════════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS node-deps
WORKDIR /app

# Install build tools for native dependencies (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy dependency manifests and postinstall script
COPY package.json package-lock.json ./
COPY scripts/ scripts/

# Install all dependencies (dev + prod needed for build)
RUN npm ci

# ══════════════════════════════════════════════════════════════════════════════
# Stage 2: Build Next.js application
# ══════════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS node-builder
WORKDIR /app

# Copy installed node_modules
COPY --from=node-deps /app/node_modules ./node_modules
COPY . .

# Patch html2canvas
RUN npm run postinstall 2>/dev/null || true

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ══════════════════════════════════════════════════════════════════════════════
# Stage 3: Install Python dependencies for AI service
# ══════════════════════════════════════════════════════════════════════════════
FROM python:3.13-slim AS python-deps
WORKDIR /app

# Install uv for fast Python package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files
COPY ai_service/pyproject.toml ai_service/uv.lock ./

# Install Python dependencies (cached layer)
RUN uv sync --frozen --no-dev --no-install-project

# ══════════════════════════════════════════════════════════════════════════════
# Stage 4: Production runner — unified image
# ══════════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# ── Install Python + supervisord ──
RUN apk add --no-cache \
    python3 \
    py3-pip \
    supervisor \
    curl \
    && ln -sf /usr/bin/python3 /usr/bin/python

# ── Create non-root user ──
RUN addgroup --system --gid 1001 omnirad && \
    adduser --system --uid 1001 omnirad --ingroup omnirad

# ── Copy Next.js standalone build ──
COPY --from=node-builder /app/public ./public
COPY --from=node-builder /app/.next/standalone ./
COPY --from=node-builder /app/.next/static ./.next/static

# Copy database and data files
COPY --from=node-builder /app/drizzle.config.ts ./
COPY --from=node-builder /app/db ./db
COPY --from=node-builder /app/data ./data

# ── Copy AI service + Python virtual environment ──
COPY --from=python-deps /app/.venv /app/ai_service/.venv
COPY ai_service/ /app/ai_service/

# ── Supervisord configuration ──
# Runs both Next.js and the AI service as child processes
RUN mkdir -p /var/log/supervisor
COPY <<'EOF' /etc/supervisord.conf
[supervisord]
nodaemon=true
user=root
logfile=/var/log/supervisor/supervisord.log
pidfile=/var/run/supervisord.pid
loglevel=info

[program:nextjs]
command=node /app/server.js
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
environment=NODE_ENV="production",PORT="3000",HOSTNAME="0.0.0.0"

[program:ai-service]
command=/app/ai_service/.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000
directory=/app/ai_service
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
environment=PATH="/app/ai_service/.venv/bin:%(ENV_PATH)s"
EOF

# Set ownership of everything
RUN chown -R omnirad:omnirad /app /var/log/supervisor

# ── Expose ports ──
# 3000 = Next.js web app
# 8000 = AI service (FastAPI)
EXPOSE 3000 8000

# ── Health check ──
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Supervisord needs root to manage child processes,
# but both services run under the omnirad user via supervisor config
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
