import "./tracing";
import app from "./app";
import { createGracefulShutdown } from "./gracefulShutdown";
import logger from "./utils/logger";
import { jobScheduler } from "./services/jobScheduler.service";
import { connectRedis } from "./utils/redis";
import { warmCache } from "./services/cache.service";
import compareRouter from "./routes/compare";

const port = process.env.PORT || 4000;

// SECURITY: BYPASS_AUTH_FOR_TESTING grants the local-dev mock user (which can
// default to broad privileges) on any request once Supabase looks offline.
// It must never run anywhere but a developer's own machine. NODE_ENV alone is
// not a reliable guard — it's trivially set to "development" in cloud/staging
// deploys — so this also checks for common cloud-platform env vars that are
// always present once the app is actually deployed, regardless of how
// NODE_ENV was configured for that deploy.
const CLOUD_PLATFORM_ENV_VARS = [
    "RAILWAY_ENVIRONMENT_NAME",
    "VERCEL",
    "RENDER",
    "FLY_APP_NAME",
    "AWS_EXECUTION_ENV",
    "KUBERNETES_SERVICE_HOST",
    "DYNO", // Heroku
];

if (
    process.env.BYPASS_AUTH_FOR_TESTING === "true" &&
    (process.env.NODE_ENV !== "development" ||
        CLOUD_PLATFORM_ENV_VARS.some((key) => Boolean(process.env[key])))
) {
    throw new Error(
        "FATAL: BYPASS_AUTH_FOR_TESTING must never be set outside local development. " +
            "Detected a non-development NODE_ENV or a cloud platform environment variable."
    );
}

if (process.env.NODE_ENV === "production" && process.env.VERIFY_ENABLE_MOCKS === "true") {
    throw new Error("FATAL: VERIFY_ENABLE_MOCKS must not be enabled in production.");
}

if (process.env.BYPASS_AUTH_FOR_TESTING === "true") {
    if (process.env.RAILWAY_ENVIRONMENT_NAME || process.env.NODE_ENV === "production") {
        throw new Error("FATAL: BYPASS_AUTH_FOR_TESTING must never be set in cloud environments.");
    }
    logger.warn(
        "SECURITY WARNING: BYPASS_AUTH_FOR_TESTING is active. Authentication is disabled for local testing."
    );
}

// Register ML medicine comparison and similarity caching routes
app.use("/api/compare", compareRouter);

if (process.env.NODE_ENV !== "test") {
    const server = app.listen(port, async () => {
        logger.info(`SahiDawa API is running at http://localhost:${port}`);

        // Initialize Redis Connection and warm cache
        await connectRedis();
        await warmCache();

        // Load dynamic OCR synonyms
        const { medicineNameNormalizer } = await import("./utils/medicineNameNormalizer.js");
        await medicineNameNormalizer.loadFromDatabase();

        // Start cron jobs only after Redis is ready
        jobScheduler.start();
    });

    const gracefulShutdown = createGracefulShutdown(server);

    process.on("uncaughtException", (error) => {
        void gracefulShutdown("uncaughtException", error);
    });

    process.on("unhandledRejection", (reason) => {
        void gracefulShutdown("unhandledRejection", reason);
    });

    const shutdown = () => {
        jobScheduler.shutdown();
        process.exit(0);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
}
