import logger from "../utils/logger";
import { startAlertBroadcaster } from "../cron/alert-broadcaster";
import { startTempCleanupJob } from "../cron/tempCleanup";
import { initExpiryCron } from "../cron/expiry-check";
import { initDistrictAlertSyncCron } from "../cron/districtAlertSync";

interface StoppableJob {
    stop: () => void;
}

class JobScheduler {
    private jobs: StoppableJob[] = [];

    public start(): void {
        if (this.jobs.length > 0) {
            logger.warn("Background jobs are already running.");
            return;
        }

        this.jobs.push(startAlertBroadcaster());
        this.jobs.push(startTempCleanupJob());
        this.jobs.push(initExpiryCron());
        this.jobs.push(initDistrictAlertSyncCron());
        logger.info("All background jobs have been started.");
    }

    public shutdown(): void {
        this.jobs.forEach((job) => job.stop());
        logger.info("All background jobs have been stopped.");
        this.jobs = [];
    }
}

export const jobScheduler = new JobScheduler();
