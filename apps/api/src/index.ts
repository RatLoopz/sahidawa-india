import "./tracing";
import app from "./app";
import { createGracefulShutdown } from "./gracefulShutdown";
import logger from "./utils/logger";
import { startAlertBroadcaster } from "./cron/alert-broadcaster";
import { startTempCleanupJob } from "./cron/tempCleanup";
import { connectRedis } from "./utils/redis";
import { warmCache } from "./services/cache.service";

const port = process.env.PORT || 4000;

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

if (process.env.NODE_ENV !== "test") {
    const server = app.listen(port, async () => {
        logger.info(`SahiDawa API is running at http://localhost:${port}`);

        // Initialize Redis Connection and warm cache
        await connectRedis();
        await warmCache();

        // Start cron jobs only after Redis is ready
        startAlertBroadcaster();
        startTempCleanupJob();
    });

    const gracefulShutdown = createGracefulShutdown(server);

    process.on("uncaughtException", (error) => {
        void gracefulShutdown("uncaughtException", error);
    });

    process.on("unhandledRejection", (reason) => {
        void gracefulShutdown("unhandledRejection", reason);
    });
}
