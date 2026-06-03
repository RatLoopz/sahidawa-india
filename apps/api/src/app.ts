import express, { Express, Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import path from "path";
import logger from "./utils/logger";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./utils/swagger";
import { validateMlServiceConfig } from "./config/mlService";
import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";
import mapRouter from './routes/map';

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
import { supabase } from "./db/client";
import { createCorsOptions } from "./config/cors";
import { errorHandler } from "./middleware/errorHandler";

// ── Application Initialization ─────────────────────────────────────────────
const app: Express = express();
app.set("trust proxy", 1); // Trust first proxy (Nginx) — fixes req.ip for rate limiters

app.use(compression());

// ── Global Middleware Configuration ───────────────────────────────────────
app.use(cookieParser());

// ── CSRF Protection (double-submit cookie pattern) ─────────────────────────
// csrf-csrf is recognized by CodeQL as a valid CSRF defense unlike custom header checks.
const {
    doubleCsrfProtection,
    generateCsrfToken: generateToken, // FIXED: Extract generateCsrfToken and alias it to generateToken
} = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET || "fallback-secret-change-in-production",
    getSessionIdentifier: (req: Request) => {
        return req.cookies?.access_token || "anonymous-session";
    },
    cookieName:
        process.env.NODE_ENV === "production" ? "__Host-psifi.x-csrf-token" : "psifi.x-csrf-token",
    cookieOptions: {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
    },
    size: 64,
    ignoredMethods: ["GET", "HEAD", "OPTIONS"],
});
// Skip CSRF in test environment so supertest can run without mock cookies
if (process.env.NODE_ENV !== "test") {
    app.use(doubleCsrfProtection);
}

// ── CSRF token endpoint — frontend fetches this once on load ───────────────
app.get("/api/csrf-token", (req: Request, res: Response) => {
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
app.use(cors(createCorsOptions()));

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
        const healthData = {
            status: error ? "degraded" : "ok",
            service: "sahidawa-api",
            version: process.env.npm_package_version || "unknown",
            environment: process.env.NODE_ENV || "development",
            uptime: `${Math.floor(uptime)}s`,
            database: { status: error ? "unreachable" : "connected" },
            services: {
                api: "healthy",
                redis: "not-configured-yet",
                mlService: "not-configured-yet",
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
            return res.status(503).json({
                ...healthData,
                database: { status: "unreachable", error: error.message },
            });
        }

        return res.status(200).json(healthData);
    } catch (err) {
        return res.status(500).json({
            status: "error",
            service: "sahidawa-api",
            error: err instanceof Error ? err.message : "Unknown error",
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
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationsRouter);
app.use("/api/v1/scan", scanRouter);
app.use("/api/v1/lasa", lasaRouter);
app.use("/api/v1/alerts", alertsRouter);
app.use("/api/ml", mlRouter);
app.use('/api/map', mapRouter);

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
