# ============================================================
# Stage 1: deps — Install all dependencies (dev + prod)
# ============================================================
FROM node:22-alpine AS deps

WORKDIR /app

# Copy workspace root manifests for optimal layer caching
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/

RUN npm ci

# ============================================================
# Stage 2: development — Hot-reload dev server (used by docker-compose.yml)
# ============================================================
FROM deps AS development

COPY . .

EXPOSE 4000

CMD ["npm", "run", "dev", "-w", "apps/api"]

# ============================================================
# Stage 3: builder — Compile TypeScript to JavaScript
# ============================================================
FROM deps AS builder

COPY . .

# tsc compiles src/ → dist/
RUN npm run build -w apps/api

# ============================================================
# Stage 4: runner — Minimal production image
# ============================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install curl for HEALTHCHECK (wget is available, but curl is
# more reliable for checking JSON API endpoints)
RUN apk add --no-cache curl

# Run as non-root for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 apiuser

# Copy workspace root manifests and install only production deps
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/web/package.json ./apps/web/

RUN npm ci --omit=dev --ignore-scripts

# Copy compiled JavaScript output
COPY --from=builder --chown=apiuser:nodejs /app/apps/api/dist ./apps/api/dist

# Copy ws-setup.js (required by the start script runtime)
COPY --from=builder --chown=apiuser:nodejs /app/apps/api/ws-setup.js ./apps/api/

# Create logs directory for Winston logger with proper permissions
RUN mkdir -p /app/logs && chown -R apiuser:nodejs /app/logs

USER apiuser

EXPOSE 4000

# Health check — verify the Express server is responding (bypassing DB check on /health)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:4000/ || exit 1

CMD ["node", "apps/api/dist/index.js"]