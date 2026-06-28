import logger from "../utils/logger";
import { startAlertBroadcaster } from "../cron/alert-broadcaster";
import { startTempCleanupJob } from "../cron/tempCleanup";

interface StoppableJob {
    stop: () => void;
}

class JobScheduler {
    private jobs: StoppableJob[] = [];

    public start(): void {
        this.jobs.push(startAlertBroadcaster());
        this.jobs.push(startTempCleanupJob());
        logger.info("All background jobs have been started.");
    }

    public shutdown(): void {
        this.jobs.forEach((job) => job.stop());
        logger.info("All background jobs have been stopped.");
        this.jobs = [];
    }
}

export const jobScheduler = new JobScheduler();
