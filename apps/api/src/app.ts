import crypto from "crypto";
import express, { Express, Request, Response, NextFunction } from "express";
import path from "path";
import logger from "./utils/logger";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./utils/swagger";
import { validateMlServiceConfig, getMlServiceUrl } from "./config/mlService";
import { redisClient } from "./utils/redis";
import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import { httpsRedirect } from "./middleware/httpsRedirect";
import { requestIdMiddleware, getRequestId } from "./middleware/requestId";
import mapRouter from "./routes/map";
import medicineSchedulesRouter from "./routes/medicineSchedules";
import { limiter, healthLimiter } from "./middleware/rateLimit";

import abhaRoutes from "./routes/abha";
import trackingRouter from "./routes/tracking";
// ── Environment Configuration ──────────────────────────────────────────────
const rootEnvPath = path.resolve(__dirname, "../../../.env");
// dotenv.config() now runs in index.ts, before this file is imported —
// removed here to avoid loading env vars twice.

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    logger.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables", {
        attemptedLocations: [rootEnvPath, path.join(process.cwd(), ".env")],
        missingVars: {
            SUPABASE_URL: !process.env.SUPABASE_URL,
            SUPABASE_ANON_KEY: !process.env.SUPABASE_ANON_KEY,
        },
    });
    process.exit(1);
}

// Execute configuration validation after import completes
validateMlServiceConfig();

if (
    process.env.NODE_ENV !== "development" &&
    process.env.NODE_ENV !== "test" &&
    !process.env.CSRF_SECRET
) {
    logger.error(
        "Missing CSRF_SECRET environment variable. The default fallback is predictable and insecure."
    );
    // Fallback to ephemeral secret instead of crashing
}

// ── Feature & Route Imports ────────────────────────────────────────────────
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import adminRoutes from "./routes/admin.routes";
import { requireAuth, requireRole, isLocalhostRequest, AuthenticatedRequest } from "./middleware/auth";
import reportsRouter from "./routes/reports";
import pharmaciesRouter from "./routes/pharmacies";
import verifyRouter from "./routes/verify";
import batchRouter from "./routes/batch";
import analyticsRoutes from "./routes/analytics";
import notificationsRouter from "./routes/notifications";
import scanRouter from "./routes/scan";
import alertsRouter from "./routes/alerts";
import lasaRouter from "./routes/lasa";
import mlRouter from "./routes/ml";
import triageRouter from "./routes/triage";
import interactionsRouter from "./routes/interactions";
import alternativesRouter from "./routes/alternatives";
import eligibilityRouter from "./routes/eligibility";
import wishlistRouter from "./routes/wishlist";
import webhooksRouter from "./routes/webhooks";
import apiKeysRouter from "./routes/apiKeys";
import safetyRouter from "./routes/safety";
import ashaRouter from "./routes/asha";
import { supabase } from "./db/client";
import * as Sentry from "@sentry/node";
import { createCorsOptions } from "./config/cors";
import { errorHandler } from "./middleware/errorHandler";
import { sentryEnabled } from "./instrument";
import { errorMetricsMiddleware } from "./middleware/errorMetrics";
import { sanitizeQueryMiddleware } from "./middleware/sanitizeQuery";
import { requestTimeout } from "./middleware/requestTimeout";
import { aggregateRateLimit } from "./middleware/aggregateRateLimit";
import { botDetection } from "./middleware/botDetection";
import { queryMetricsMiddleware } from "./middleware/queryMetrics";
// ── Application Initialization ─────────────────────────────────────────────
const app: Express = express();
app.set("trust proxy", 1); // Trust first proxy (Nginx) — fixes req.ip for rate limiters

// ── Request Correlation ID ─────────────────────────────────────────────────
// Must be the first middleware so every downstream handler and log entry
// can access the x-request-id via AsyncLocalStorage.
app.use(requestIdMiddleware);

// ── Error Metrics Tracking ─────────────────────────────────────────────────
// Tracks error rates by route and status code in Redis for monitoring.
app.use(errorMetricsMiddleware);

// ── Health Check (lightweight reachability ping) ───────────────────────────
// Public probe stays shallow — no env, memory, dependency, or ML URL details.
app.get("/health", healthLimiter, (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
});

async function probeDatabase(): Promise<{ error: unknown; latencyMs: number }> {
    const dbStart = Date.now();
    const { error } = await supabase.from("medicines").select("id").limit(1);
    return { error, latencyMs: Date.now() - dbStart };
}

async function probeRedis(): Promise<{ status: string; latencyMs: number | null }> {
    if (!redisClient.isOpen) {
        return { status: "disconnected", latencyMs: null };
    }

    const redisStart = Date.now();
    try {
        await redisClient.ping();
        return { status: "connected", latencyMs: Date.now() - redisStart };
    } catch {
        return { status: "unhealthy", latencyMs: Date.now() - redisStart };
    }
}

async function probeMlService(): Promise<{
    status: string;
    latencyMs: number;
    url: string | null;
}> {
    const mlUrl = getMlServiceUrl();
    if (!mlUrl) {
        return { status: "not-configured", latencyMs: 0, url: null };
    }

    const mlStart = Date.now();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const mlRes = await fetch(mlUrl, { method: "HEAD", signal: controller.signal });
        clearTimeout(timeout);
        return {
            status: mlRes.ok ? "healthy" : "unreachable",
            latencyMs: Date.now() - mlStart,
            url: mlUrl,
        };
    } catch {
        return { status: "unreachable", latencyMs: Date.now() - mlStart, url: mlUrl };
    }
}

function buildDetailedHealthPayload(input: {
    dbError: unknown;
    dbLatencyMs: number;
    redisStatus: string;
    redisLatencyMs: number | null;
    mlStatus: string;
    mlLatencyMs: number;
    mlUrl: string | null;
    responseTimeMs: number;
}) {
    const {
        dbError,
        dbLatencyMs,
        redisStatus,
        redisLatencyMs,
        mlStatus,
        mlLatencyMs,
        mlUrl,
        responseTimeMs,
    } = input;

    // ML service is optional — "not-configured" does not degrade overallStatus.
    const overallStatus =
        !dbError && redisStatus === "connected" && (mlUrl === null || mlStatus === "healthy")
            ? "healthy"
            : "degraded";

    return {
        status: overallStatus,
        service: "sahidawa-api",
        version: process.env.npm_package_version || "unknown",
        environment: process.env.NODE_ENV || "development",
        uptime: `${Math.floor(process.uptime())}s`,
        dependencies: {
            database: {
                status: dbError ? "down" : "up",
                latencyMs: dbLatencyMs,
                ...(dbError && { error: "Database connection failed" }),
            },
            redis: {
                status: redisStatus === "connected" ? "up" : redisStatus,
                latencyMs: redisLatencyMs,
            },
            mlService: {
                status: mlStatus === "healthy" ? "up" : mlStatus,
                latencyMs: mlLatencyMs,
                ...(mlUrl && { url: mlUrl }),
            },
        },
        database: { status: dbError ? "unreachable" : "connected" },
        services: {
            api: "healthy",
            redis: redisStatus,
            mlService: mlStatus,
        },
        system: {
            nodeVersion: process.version,
            platform: process.platform,
            memoryUsage: {
                rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`,
                heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
            },
        },
        responseTimeMs,
        timestamp: new Date().toISOString(),
    };
}

async function detailedHealthHandler(_req: Request, res: Response) {
    const overallStart = Date.now();
    try {
        const database = await probeDatabase();
        const redis = await probeRedis();
        const ml = await probeMlService();

        const healthData = buildDetailedHealthPayload({
            dbError: database.error,
            dbLatencyMs: database.latencyMs,
            redisStatus: redis.status,
            redisLatencyMs: redis.latencyMs,
            mlStatus: ml.status,
            mlLatencyMs: ml.latencyMs,
            mlUrl: ml.url,
            responseTimeMs: Date.now() - overallStart,
        });

        if (database.error) {
            logger.error("Health check database failure", { error: database.error });
            return res.status(503).json(healthData);
        }

        return res.status(200).json(healthData);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        logger.error("Health check error", { error: err, errorMessage });
        return res.status(500).json({
            status: "error",
            service: "sahidawa-api",
            error: "Service health check failed",
            responseTimeMs: Date.now() - overallStart,
            timestamp: new Date().toISOString(),
        });
    }
}

function requireDetailedHealthAccess(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): void {
    if (isLocalhostRequest(req)) {
        next();
        return;
    }

    void requireAuth(req, res, () => {
        requireRole("admin")(req, res, next);
    });
}

// Protect all other routes with the general limiter
app.use(limiter);

// ── Bot detection (lightweight, runs on every request) ─────────────────────
app.use(botDetection());

// ── Global aggregate rate limit (safety net across all endpoints) ──────────
app.use(aggregateRateLimit);

// ── Query Metrics & Slow Query Detection ───────────────────────────────────
// Logs slow queries (>500ms warn, >2000ms error) for performance monitoring.
app.use(queryMetricsMiddleware);

// ── Security: Enforce HTTPS in production ──────────────────────────────────
// Redirects all HTTP requests to HTTPS (301) to protect sensitive healthcare data
app.use(httpsRedirect);

app.use(compression());
// ── Global Middleware Configuration ───────────────────────────────────────
app.use(cookieParser());

// Detailed health — localhost or authenticated admin only (no public infra disclosure).
app.get("/health/details", healthLimiter, requireDetailedHealthAccess, detailedHealthHandler);

// ── CSRF Protection (double-submit cookie pattern) ─────────────────────────
app.use(cors(createCorsOptions()));
// csrf-csrf is recognized by CodeQL as a valid CSRF defense unlike custom header checks.
const ANON_SESSION_COOKIE = "csrf_anon_id";

// Decided once at startup so it stays stable even if a test mutates NODE_ENV.
const SKIP_CSRF_VALIDATION = process.env.NODE_ENV === "test";

// Ephemeral fallback secret for local dev when CSRF_SECRET is unset (see getSecret).
let devCsrfSecret: string | undefined;

const { doubleCsrfProtection, generateCsrfToken: generateToken } = doubleCsrf({
    getSecret: () => {
        const secret = process.env.CSRF_SECRET;
        if (secret) return secret;
        // Production never reaches here: startup exits when CSRF_SECRET is missing
        // outside dev/test. Now that the middleware runs in development too, mint a
        // random per-process secret so local dev works without extra setup instead
        // of 500-ing every request. Generated (not hardcoded) so it is never a
        // predictable credential; it simply won't survive a restart.
        if (!devCsrfSecret) {
            devCsrfSecret = crypto.randomBytes(32).toString("hex");
            logger.warn(
                "CSRF_SECRET is not set — using an ephemeral per-process dev secret. Set the CSRF_SECRET environment variable outside local development."
            );
        }
        return devCsrfSecret;
    },
    getSessionIdentifier: (req: Request) => {
        if (req.cookies?.access_token) {
            return req.cookies.access_token;
        }
        return req.cookies?.[ANON_SESSION_COOKIE] || crypto.randomUUID();
    },
    cookieName:
        process.env.NODE_ENV === "production" ? "__Host-psifi.x-csrf-token" : "psifi.x-csrf-token",
    cookieOptions: {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
    },
    size: 64,
    // Let the automated test suites bypass token validation without stripping the
    // middleware from the app. The supertest suites don't run the token handshake.
    // Captured once at load (like the previous env gate) so tests that flip
    // NODE_ENV mid-run to exercise prod branches don't suddenly hit CSRF.
    skipCsrfProtection: (req: Request) => {
        if (SKIP_CSRF_VALIDATION) return true;
        const path = req.path;
        const exemptPrefixes = ["/api/webhooks"];
        const exemptPaths = ["/api/notifications/twilio-webhook"];
        return exemptPrefixes.some((p) => path.startsWith(p)) || exemptPaths.includes(path);
    },
});

// Registered in every environment so CodeQL sees CSRF middleware on every route
// (resolves Alert 136) and development mirrors production, surfacing CSRF
// integration issues locally instead of only after deploy.
app.use(doubleCsrfProtection);
// Note: csurf() was removed as it was a redundant no-op mock.
// doubleCsrfProtection from csrf-csrf handles all CSRF protection.

// ── CSRF token endpoint — frontend fetches this once on load ───────────────
app.get("/api/csrf-token", (req: Request, res: Response) => {
    if (!req.cookies?.[ANON_SESSION_COOKIE] && !req.cookies?.access_token) {
        const anonId = crypto.randomUUID();

        // FIX: Mutate req.cookies so generateToken binds to this exact ID
        if (!req.cookies) req.cookies = {};
        req.cookies[ANON_SESSION_COOKIE] = anonId;

        res.cookie(ANON_SESSION_COOKIE, anonId, {
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            path: "/",
        });
    }
    res.json({ csrfToken: generateToken(req, res) });
});

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                connectSrc: ["'self'", process.env.SUPABASE_URL || ""],
            },
        },
    })
);

// Security: restrict CORS to known origins and allow credentials for secure cookies

app.use(express.json({ limit: "1mb" }));

// ── Request Timeout (30s) ──────────────────────────────────────────────────
// Prevents clients from holding connections open indefinitely.
app.use(requestTimeout(30_000));

// ── Query Sanitization ─────────────────────────────────────────────────────
// Auto-applies escapePostgrest() + escapeIlike() to all string query values
// as a defense-in-depth measure against PostgREST injection (Issue #3924).
app.use(sanitizeQueryMiddleware);

app.use(
    morgan((tokens, req: Request, res: Response) => {
        const status = res.statusCode;
        const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
        const requestId = getRequestId() ?? (req as Request & { requestId?: string }).requestId;
        logger.log({
            level,
            message: `${tokens.method(req, res)} ${tokens.url(req, res)} ${status} - ${tokens["response-time"](req, res)} ms`,
            ...(requestId && { requestId }),
        });
        return undefined;
    })
);

// ── Core Routes ────────────────────────────────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
    logger.info("Root route accessed");
    res.status(200).json({
        name: "SahiDawa API",
        description: "India's Open-Source Citizen Medicine Verifier & Rural Health Bridge",
        version: process.env.npm_package_version || "0.1.0",
        status: "running",
        environment: process.env.NODE_ENV || "development",
        endpoints: {
            health: "/health",
            healthDetails: "/health/details",
            docs: "/api/docs",
            csrfToken: "/api/csrf-token",
        },
        repository: "https://github.com/RatLoopz/sahidawa-india",
        timestamp: new Date().toISOString(),
    });
});

// Admin Routes — protected: must be authenticated + have admin or moderator role
app.use("/api/v1/admin", requireAuth, requireRole("admin", "moderator"), adminRoutes);

// Health route relocated to the top of the file to guarantee rate limiter execution before other middleware.

// ── Feature API Modules ────────────────────────────────────────────────────
app.use("/api/reports", reportsRouter);
app.use("/api/pharmacies", pharmaciesRouter);
app.use("/api/verify/batch", batchRouter);
app.use("/api/verify", verifyRouter);
app.use("/api/analytics", requireAuth, requireRole("admin", "moderator"), analyticsRoutes);
app.use("/api/notifications", notificationsRouter);
app.use("/api/v1/notifications", notificationsRouter);
app.use("/api/v1/scan", scanRouter);
app.use("/api/v1/lasa", lasaRouter);
app.use("/api/v1/alerts", alertsRouter);
app.use("/api/v1/alternatives", alternativesRouter);
app.use("/api/ml", mlRouter);
app.use("/api/triage", triageRouter);
app.use("/api/map", mapRouter);
app.use("/api/v1/interactions", interactionsRouter);
app.use("/api/schedules", medicineSchedulesRouter);
app.use("/api/v1/abha", abhaRoutes);
app.use("/api/v1/scheme-eligibility", eligibilityRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/v1/medicines", trackingRouter);
app.use("/api/v1/wishlist", wishlistRouter);
app.use("/api/v1/asha", ashaRouter);
app.use("/api/keys", apiKeysRouter);
app.use("/api/medicine/safety", safetyRouter);

// ── Swagger UI Documentation (/api/docs) ──────────────────────────────────
app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        customSiteTitle: "SahiDawa API Docs",
        customCss: `
      .topbar { background-color: #1a7f5a; }
      .topbar-wrapper img { display: none; }
      .topbar-wrapper::after {
        content: "🩺 SahiDawa API";
        color: white;
        font-size: 1.4rem;
        font-weight: bold;
        padding-left: 1rem;
      }
    `,
    })
);

app.get("/api/docs.json", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
});

// ── Error Management Middleware ────────────────────────────────────────────
// Sentry must capture the exception before our custom errorHandler runs,
// so it sees the raw error before any response shaping/redaction happens.
if (sentryEnabled) {
    Sentry.setupExpressErrorHandler(app);
}

app.use(errorHandler);

export default app;
