import logger from "../utils/logger";
import { startAlertBroadcaster } from "../cron/alert-broadcaster";
import { startTempCleanupJob } from "../cron/tempCleanup";
import { initExpiryCron } from "../cron/expiry-check";
import { initDosageReminderCron } from "../cron/dosage-reminder";
import { initDistrictAlertSyncCron } from "../cron/districtAlertSync";
import { startPgCronMonitor } from "../cron/pgCronMonitor";
import { startSmsWorker } from "../workers/smsWorker";

interface StoppableJob {
    stop: () => void | Promise<void>;
}

class JobScheduler {
    private jobs: StoppableJob[] = [];

    public start(): void {
        if (this.jobs.length > 0) {
            logger.warn("Background jobs are already running.");
            return;
        }

        this.jobs.push(
            startAlertBroadcaster(),
            startTempCleanupJob(),
            initExpiryCron(),
            initDosageReminderCron(),
            initDistrictAlertSyncCron(),
            startPgCronMonitor(),
            startSmsWorker()
        );
        logger.info("All background jobs have been started.");
    }

    public async shutdown(): Promise<void> {
        await Promise.all(this.jobs.map((job) => job.stop()));
        logger.info("All background jobs have been stopped.");
        this.jobs = [];
    }
}

export const jobScheduler = new JobScheduler();
