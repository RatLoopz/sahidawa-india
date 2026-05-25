import type { Server } from "http";
import { createGracefulShutdown } from "../src/gracefulShutdown";
import { supabase } from "../src/db/client";
import logger from "../src/utils/logger";

jest.mock("../src/db/client", () => ({
    supabase: {
        removeAllChannels: jest.fn().mockResolvedValue(undefined),
        auth: {
            stopAutoRefresh: jest.fn(),
        },
    },
}));

jest.mock("../src/utils/logger", () => ({
    __esModule: true,
    default: {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
    },
}));

describe("createGracefulShutdown", () => {
    const exitProcess = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    function createServerMock(): Server {
        return {
            close: jest.fn((callback: (error?: Error) => void) => callback()),
        } as unknown as Server;
    }

    it("closes the server, releases database resources, and exits for uncaught exceptions", async () => {
        const server = createServerMock();
        const shutdown = createGracefulShutdown(server, { exitProcess, timeoutMs: 1000 });

        await shutdown("uncaughtException", new Error("boom"));

        expect(server.close).toHaveBeenCalledTimes(1);
        expect(supabase.removeAllChannels).toHaveBeenCalledTimes(1);
        expect(supabase.auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(
            "uncaughtException detected. Starting graceful shutdown.",
            expect.objectContaining({ reason: "uncaughtException" })
        );
        expect(exitProcess).toHaveBeenCalledWith(1);
    });

    it("handles unhandled rejections with non-error reasons", async () => {
        const server = createServerMock();
        const shutdown = createGracefulShutdown(server, { exitProcess, timeoutMs: 1000 });

        await shutdown("unhandledRejection", "rejected");

        expect(server.close).toHaveBeenCalledTimes(1);
        expect(supabase.removeAllChannels).toHaveBeenCalledTimes(1);
        expect(logger.error).toHaveBeenCalledWith(
            "unhandledRejection detected. Starting graceful shutdown.",
            expect.objectContaining({
                reason: "unhandledRejection",
                error: { message: "rejected" },
            })
        );
        expect(exitProcess).toHaveBeenCalledWith(1);
    });
});
