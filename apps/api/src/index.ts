import "./tracing";
import app from "./app";
import { createGracefulShutdown } from "./gracefulShutdown";
import logger from "./utils/logger";
import { jobScheduler } from "./services/jobScheduler.service";
import { connectRedis } from "./utils/redis";
import { warmCache } from "./services/cache.service";

const port = process.env.PORT || 4000;

if (process.env.NODE_ENV === "production" && process.env.VERIFY_ENABLE_MOCKS === "true") {
    throw new Error("FATAL: VERIFY_ENABLE_MOCKS must not be enabled in production.");
}

if (process.env.NODE_ENV !== "test") {
    const server = app.listen(port, async () => {
        logger.info(`SahiDawa API is running at http://localhost:${port}`);

        // Initialize Redis Connection and warm cache
        await connectRedis();
        await warmCache();

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
