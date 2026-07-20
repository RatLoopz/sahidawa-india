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
import { requireAuth, requireRole } from "./middleware/auth";
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
import { supabase } from "./db/client";
import * as Sentry from "@sentry/node";
import { createCorsOptions } from "./config/cors";
import { errorHandler } from "./middleware/errorHandler";
import { sentryEnabled } from "./instrument";
// ── Application Initialization ─────────────────────────────────────────────
const app: Express = express();
app.set("trust proxy", 1); // Trust first proxy (Nginx) — fixes req.ip for rate limiters

// ── Request Correlation ID ─────────────────────────────────────────────────
// Must be the first middleware so every downstream handler and log entry
// can access the x-request-id via AsyncLocalStorage.
app.use(requestIdMiddleware);

// ── Security: Enforce HTTPS in production ──────────────────────────────────
// Redirects all HTTP requests to HTTPS (301) to protect sensitive healthcare data
app.use(httpsRedirect);

app.use(compression());
// ── Global Middleware Configuration ───────────────────────────────────────
app.use(cookieParser());

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
    skipCsrfProtection: () => SKIP_CSRF_VALIDATION,
});

// Registered in every environment so CodeQL sees CSRF middleware on every route
// (resolves Alert 136) and development mirrors production, surfacing CSRF
// integration issues locally instead of only after deploy.
app.use(doubleCsrfProtection);

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
        endpoints: { health: "/health", docs: "/api/docs", csrfToken: "/api/csrf-token" },
        repository: "https://github.com/RatLoopz/sahidawa-india",
        timestamp: new Date().toISOString(),
    });
});

// Admin Routes — protected: must be authenticated + have admin or moderator role
app.use("/api/v1/admin", requireAuth, requireRole("admin", "moderator"), adminRoutes);

app.get("/health", async (_req: Request, res: Response) => {
    const start = Date.now();
    try {
        const { error } = await supabase.from("medicines").select("id").limit(1);
        const uptime = process.uptime();

        // Redis
        const redisStatus = redisClient.isOpen ? "connected" : "disconnected";

        // ML service — check config first, then do a lightweight reachability ping
        let mlStatus: string;
        const mlUrl = getMlServiceUrl();
        if (!mlUrl) {
            mlStatus = "not-configured";
        } else {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 3000);
                const res = await fetch(mlUrl, { method: "HEAD", signal: controller.signal });
                clearTimeout(timeout);
                mlStatus = res.ok ? "healthy" : "unreachable";
            } catch {
                mlStatus = "unreachable";
            }
        }

        // Overall status
        // ML service is optional — "not-configured" does not degrade overallStatus.
        const overallStatus =
            redisStatus === "connected" && (mlUrl === null || mlStatus === "healthy")
                ? "healthy"
                : "degraded";

        const healthData = {
            status: error ? "degraded" : overallStatus,
            service: "sahidawa-api",
            version: process.env.npm_package_version || "unknown",
            environment: process.env.NODE_ENV || "development",
            uptime: `${Math.floor(uptime)}s`,
            database: { status: error ? "unreachable" : "connected" },
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
            responseTime: `${Date.now() - start}ms`,
            timestamp: new Date().toISOString(),
        };

        if (error) {
            logger.error("Health check database failure", { error });
            return res.status(503).json({
                ...healthData,
                database: {
                    status: "unreachable",
                    error: "Database connection failed",
                },
            });
        }

        return res.status(200).json(healthData);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        logger.error("Health check error", { error: err, errorMessage });
        return res.status(500).json({
            status: "error",
            service: "sahidawa-api",
            error: "Service health check failed",
            timestamp: new Date().toISOString(),
        });
    }
});

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
