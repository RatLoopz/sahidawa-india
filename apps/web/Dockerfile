# ============================================================
# Stage 1: deps — Install all dependencies (dev + prod)
# ============================================================
FROM node:22-alpine AS deps

WORKDIR /app

# Copy workspace root manifests first for optimal layer caching.
# Any change to source code will NOT invalidate this layer.
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/

RUN npm ci

# ============================================================
# Stage 2: development — Hot-reload dev server (used by docker-compose.yml)
# ============================================================
FROM deps AS development

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "-w", "apps/web"]

# ============================================================
# Stage 3: builder — Build the Next.js production bundle
# ============================================================
FROM deps AS builder

COPY . .

# Build produces .next/standalone (self-contained server)
# and .next/static (hashed client assets).
RUN npm run build -w apps/web

# ============================================================
# Stage 4: runner — Minimal production image (~150 MB)
# ============================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# Disable Next.js anonymous telemetry in production containers
ENV NEXT_TELEMETRY_DISABLED=1

# Run as non-root for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy the standalone server (includes a minimal node_modules tree)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./

# Copy the static assets that Next.js does NOT bundle into standalone
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Copy the public folder (manifest.json, sw.js, icons, etc.)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

# Health check — verify the Next.js server is responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

# The standalone output creates a server.js at the workspace path
CMD ["node", "apps/web/server.js"]