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
import { limiter } from "./middleware/rateLimit";
import reportsRouter from "./routes/reports";
import pharmaciesRouter from "./routes/pharmacies";
import verifyRouter from "./routes/verify";
import analyticsRoutes from "./routes/analytics";
import notificationsRouter from "./routes/notifications";
import scanRouter from "./routes/scan";
import alertsRouter from "./routes/alerts";
import { supabase } from "./db/client";

import { errorHandler } from "./middleware/errorHandler";

const app: Express = express();

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            connectSrc: ["'self'", process.env.SUPABASE_URL || ""],
        },
    },
}));

// Security: restrict CORS to known origins instead of wildcard
const allowedOrigins = ["http://localhost:3000", "http://localhost:4000", "http://localhost:8000"];
app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
    })
);

app.use(express.json({ limit: "1mb" }));
app.use(limiter);

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

app.get("/", (req: Request, res: Response) => {
    logger.info("Root route accessed");
    res.send("SahiDawa-India API is running successfully!");
});

// Admin Routes
app.use("/api/v1/admin", adminRoutes);

app.get("/health", async (req: Request, res: Response) => {
    logger.info("Health check endpoint accessed");

    try {
        const { error } = await supabase.from("medicines").select("id").limit(1);

        if (error) {
            return res.status(503).json({
                status: "degraded",
                db: "unreachable",
                error: error.message,
                timestamp: new Date().toISOString(),
            });
        }

        return res.json({
            status: "ok",
            db: "connected",
            timestamp: new Date().toISOString(),
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return res.status(500).json({
            status: "error",
            db: "unreachable",
            error: message,
            timestamp: new Date().toISOString(),
        });
    }
});

app.use("/reports", reportsRouter);
app.use("/api/pharmacies", pharmaciesRouter);
app.use("/api/verify", verifyRouter);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/notifications", notificationsRouter);
app.use("/api/v1/scan", scanRouter);
app.use("/api/v1/alerts", alertsRouter);

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
