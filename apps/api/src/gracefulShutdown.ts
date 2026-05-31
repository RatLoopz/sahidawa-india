import type { Server } from "http";
import { supabase } from "./db/client";
import logger from "./utils/logger";

type ShutdownReason = "uncaughtException" | "unhandledRejection";

type ShutdownOptions = {
    exitProcess?: (code: number) => never | void;
    timeoutMs?: number;
};

type SupabaseResourceClient = typeof supabase & {
    removeAllChannels?: () => Promise<unknown> | unknown;
    auth?: {
        stopAutoRefresh?: () => void;
    };
};

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000;

function getErrorDetails(error: unknown) {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }

    return {
        message: String(error),
    };
}

function closeServer(server: Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close((error?: Error) => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

async function releaseDatabaseResources(): Promise<void> {
    const client = supabase as SupabaseResourceClient;

    await Promise.resolve(client.removeAllChannels?.());
    client.auth?.stopAutoRefresh?.();
}

export function createGracefulShutdown(server: Server, options: ShutdownOptions = {}) {
    const exitProcess = options.exitProcess ?? process.exit;
    const timeoutMs = options.timeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
    let isShuttingDown = false;

    return async (reason: ShutdownReason, error: unknown): Promise<void> => {
        if (isShuttingDown) {
            logger.warn("Graceful shutdown already in progress", { reason });
            return;
        }

        isShuttingDown = true;
        logger.error(`${reason} detected. Starting graceful shutdown.`, {
            reason,
            error: getErrorDetails(error),
        });

        const timeout = setTimeout(() => {
            logger.error("Graceful shutdown timed out. Forcing process exit.", {
                reason,
                timeoutMs,
            });
            exitProcess(1);
        }, timeoutMs);
        timeout.unref();

        try {
            await closeServer(server);
            logger.info("HTTP server closed during graceful shutdown", { reason });

            await releaseDatabaseResources();
            logger.info("Database resources released during graceful shutdown", { reason });
        } catch (shutdownError) {
            logger.error("Error during graceful shutdown", {
                reason,
                error: getErrorDetails(shutdownError),
            });
        } finally {
            clearTimeout(timeout);
            exitProcess(1);
        }
    };
}
