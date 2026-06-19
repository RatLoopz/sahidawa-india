import app from "./app";
import { createGracefulShutdown } from "./gracefulShutdown";
import logger from "./utils/logger";
import { startAlertBroadcaster } from "./cron/alert-broadcaster";
import { connectRedis } from "./utils/redis";
import { warmCache } from "./services/cache.service";

const port = process.env.PORT || 4000;

if (process.env.NODE_ENV !== "test") {
    const server = app.listen(port, async () => {
        logger.info(`SahiDawa API is running at http://localhost:${port}`);

        // Initialize Redis Connection and warm cache
        await connectRedis();
        await warmCache();
    });

    startAlertBroadcaster();

    const gracefulShutdown = createGracefulShutdown(server);

    process.on("uncaughtException", (error) => {
        void gracefulShutdown("uncaughtException", error);
    });

    process.on("unhandledRejection", (reason) => {
        void gracefulShutdown("unhandledRejection", reason);
    });
}
