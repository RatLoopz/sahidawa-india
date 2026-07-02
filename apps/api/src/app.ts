import crypto from "crypto";
import express, { Express, Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import path from "path";
import logger from "./utils/logger";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./utils/swagger";
import { validateMlServiceConfig, getMlServiceUrl } from "./config/mlService";
import { redisClient } from "./utils/redis";
import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import { httpsRedirect } from "./middleware/httpsRedirect";
import mapRouter from "./routes/map";
import medicineSchedulesRouter from "./routes/medicineSchedules";

import abhaRoutes from "./routes/abha";
import trackingRouter from "./routes/tracking";
import { initExpiryCron } from "./cron/expiry-check";
import { initDistrictAlertSyncCron } from "./cron/districtAlertSync";
// ── Environment Configuration ──────────────────────────────────────────────
const rootEnvPath = path.resolve(__dirname, "../../../.env");
dotenv.config({ path: rootEnvPath });

if (!process.env.SUPABASE_URL) {
    dotenv.config();
}

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
    process.exit(1);
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
import { supabase } from "./db/client";
import { createCorsOptions } from "./config/cors";
import { errorHandler } from "./middleware/errorHandler";
// ── Application Initialization ─────────────────────────────────────────────
const app: Express = express();
app.set("trust proxy", 1); // Trust first proxy (Nginx) — fixes req.ip for rate limiters

// ── Security: Enforce HTTPS in production ──────────────────────────────────
// Redirects all HTTP requests to HTTPS (301) to protect sensitive healthcare data
app.use(httpsRedirect);

app.use(compression());
initExpiryCron();
initDistrictAlertSyncCron();
// ── Global Middleware Configuration ───────────────────────────────────────
app.use(cookieParser());

// ── CSRF Protection (double-submit cookie pattern) ─────────────────────────
app.use(cors(createCorsOptions()));
// csrf-csrf is recognized by CodeQL as a valid CSRF defense unlike custom header checks.
const ANON_SESSION_COOKIE = "csrf_anon_id";

const { doubleCsrfProtection, generateCsrfToken: generateToken } = doubleCsrf({
    getSecret: () => {
        const secret = process.env.CSRF_SECRET;
        if (!secret) {
            logger.error("CSRF_SECRET environment variable is not set");
            throw new Error("CSRF_SECRET environment variable is required");
        }
        return secret;
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
});

// Skip CSRF in test and development environments to support cross-port local testing
const isTestOrDev = process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development";
app.use((req: Request, res: Response, next: NextFunction) => {
    if (isTestOrDev) {
        return next();
    }
    doubleCsrfProtection(req, res, next);
});

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
        logger.log({
            level,
            message: `${tokens.method(req, res)} ${tokens.url(req, res)} ${status} - ${tokens["response-time"](req, res)} ms`,
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
        const overallStatus =
            redisStatus === "connected" &&
            mlStatus !== "not-configured" &&
            mlStatus !== "unreachable"
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
app.use("/reports", reportsRouter);
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
app.use(errorHandler);

export default app;
