# ── Stage 1: Install dependencies ──
FROM python:3.13-slim AS deps
WORKDIR /app

# Install uv for fast Python package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies (cached layer)
RUN uv sync --frozen --no-dev --no-install-project

# ── Stage 2: Production runner ──
FROM python:3.13-slim AS runner
WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Create non-root user for security
RUN groupadd --system --gid 1001 appuser && \
    useradd --system --uid 1001 --gid appuser appuser

# Copy installed dependencies from deps stage
COPY --from=deps /app/.venv ./.venv

# Copy application code
COPY . .

# Remove unnecessary files
RUN rm -rf __pycache__ .venv/lib/python*/site-packages/__pycache__ && \
    chown -R appuser:appuser /app

USER appuser

# Expose the FastAPI port
EXPOSE 8000

ENV PATH="/app/.venv/bin:$PATH"

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
