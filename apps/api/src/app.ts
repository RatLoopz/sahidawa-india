import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import path from "path";
import logger from "./utils/logger";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./utils/swagger";

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

import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import adminRoutes from "./routes/admin.routes";
import { requireAuth, requireRole } from "./middleware/auth";

import reportsRouter from "./routes/reports";
import pharmaciesRouter from "./routes/pharmacies";
import verifyRouter from "./routes/verify";
import analyticsRoutes from "./routes/analytics";
import notificationsRouter from "./routes/notifications";
import scanRouter from "./routes/scan";
import alertsRouter from "./routes/alerts";
import lasaRouter from "./routes/lasa";
import mlRouter from "./routes/ml";
import { supabase } from "./db/client";
import { createCorsOptions } from "./config/cors";

import { errorHandler } from "./middleware/errorHandler";

const app: Express = express();

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                connectSrc: ["'self'", process.env.SUPABASE_URL || ""],
            },
        },
    })
);

// Security: restrict CORS to known origins instead of wildcard
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
            docs: "/api/docs",
        },

        repository: "https://github.com/RatLoopz/sahidawa-india",

        timestamp: new Date().toISOString(),
    });
});

// Admin Routes — protected: must be authenticated + have admin role
app.use("/api/v1/admin", requireAuth, requireRole("admin"), adminRoutes);

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

            database: {
                status: error ? "unreachable" : "connected",
            },

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
                database: {
                    status: "unreachable",
                    error: error.message,
                },
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

app.use("/api/reports", reportsRouter);
app.use("/reports", reportsRouter);
app.use("/api/pharmacies", pharmaciesRouter);
app.use("/api/verify", verifyRouter);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationsRouter);
app.use("/api/v1/scan", scanRouter);
app.use("/api/v1/lasa", lasaRouter);
app.use("/api/v1/alerts", alertsRouter);
app.use("/api/ml", mlRouter);

// ── Swagger UI (/api/docs) ──────────────────────────────────────────────────
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

// Also expose raw spec as JSON for tooling (Postman, etc.)
app.get("/api/docs.json", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
});

app.use(errorHandler);

export default app;
