import fs from "fs";
import path from "path";
import logger from "../utils/logger";

const UPLOAD_DIR = path.join(__dirname, "../../temp-uploads");
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
const CHECK_INTERVAL_MS = process.env.NODE_ENV === "test" ? 1000 : 60 * 60 * 1000; // 1 hour

let intervalId: NodeJS.Timeout | null = null;

export function sweepOrphanedTempFiles(): void {
    let files: string[];
    try {
        files = fs.readdirSync(UPLOAD_DIR);
    } catch (err) {
        logger.error({ message: `Failed to read ${UPLOAD_DIR}`, error: err });
        return;
    }

    const now = Date.now();
    let removedCount = 0;

    for (const file of files) {
        const filePath = path.join(UPLOAD_DIR, file);
        try {
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > MAX_AGE_MS) {
                fs.unlinkSync(filePath);
                removedCount++;
            }
        } catch (err) {
            // File may have already been removed by the request's own
            // cleanup() between readdirSync and statSync/unlinkSync — benign.
            logger.error({ message: `Failed to process temp file ${filePath}`, error: err });
        }
    }

    if (removedCount > 0) {
        logger.info(`Temp cleanup: removed ${removedCount} orphaned file(s) from ${UPLOAD_DIR}`);
    }
}

export function startTempCleanupJob(): void {
    if (intervalId) {
        logger.warn("Temp cleanup job is already running.");
        return;
    }

    logger.info(`Starting temp upload cleanup loop (interval: ${CHECK_INTERVAL_MS}ms)`);

    // Run an initial sweep shortly after boot, not just after the first interval
    setTimeout(() => {
        sweepOrphanedTempFiles();
    }, 2000);

    intervalId = setInterval(() => {
        sweepOrphanedTempFiles();
    }, CHECK_INTERVAL_MS);
}

export function stopTempCleanupJob(): void {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        logger.info("Stopped temp upload cleanup loop");
    }
}
