import logger from "../utils/logger";
import { serviceRoleSupabase } from "../db/client";

// Polling interval in ms (default to 1 hour if not specified)
const CHECK_INTERVAL_MS = process.env.PG_CRON_MONITOR_INTERVAL_MS
    ? parseInt(process.env.PG_CRON_MONITOR_INTERVAL_MS, 10)
    : process.env.NODE_ENV === "test"
      ? 1000
      : 60 * 60 * 1000;

const WEBHOOK_URL = process.env.PG_CRON_MONITOR_WEBHOOK_URL;

let intervalId: NodeJS.Timeout | null = null;
let lastChecked: Date;

export async function checkFailedPgCronJobs(): Promise<void> {
    const jobName = "cleanup_scan_history";

    try {
        const { data, error } = await serviceRoleSupabase.rpc("get_failed_pg_cron_jobs", {
            p_job_name: jobName,
            p_since_time: lastChecked.toISOString(),
        });

        // Always update lastChecked to now, regardless of failure, so we don't spam the same alerts.
        const currentTime = new Date();

        if (error) {
            logger.error({ message: "Failed to fetch pg_cron job statuses from Supabase", error });
            return;
        }

        if (data && data.length > 0) {
            logger.warn(`Found ${data.length} failed execution(s) for pg_cron job '${jobName}'`);

            for (const failure of data) {
                await sendDiscordAlert(jobName, failure);
            }
        }

        lastChecked = currentTime;
    } catch (err) {
        logger.error({ message: "Error in checkFailedPgCronJobs execution", error: err });
    }
}

async function sendDiscordAlert(jobName: string, failure: any): Promise<void> {
    if (!WEBHOOK_URL) {
        logger.warn("PG_CRON_MONITOR_WEBHOOK_URL is not set. Skipping Discord alert.");
        return;
    }

    try {
        const payload = {
            embeds: [
                {
                    title: `🚨 pg_cron Job Failed: ${jobName}`,
                    color: 16711680, // Red
                    fields: [
                        { name: "Job ID", value: String(failure.jobid), inline: true },
                        { name: "Run ID", value: String(failure.runid), inline: true },
                        {
                            name: "Start Time",
                            value: failure.start_time
                                ? new Date(failure.start_time).toLocaleString()
                                : "Unknown",
                            inline: false,
                        },
                        {
                            name: "End Time",
                            value: failure.end_time
                                ? new Date(failure.end_time).toLocaleString()
                                : "Unknown",
                            inline: false,
                        },
                        {
                            name: "Error Message",
                            value: failure.return_message || "No error message provided",
                            inline: false,
                        },
                        {
                            name: "Command",
                            value: `\`\`\`sql\n${failure.command}\n\`\`\``,
                            inline: false,
                        },
                    ],
                    timestamp: new Date().toISOString(),
                },
            ],
        };

        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            logger.error(`Failed to send Discord alert for ${jobName}. Status: ${response.status}`);
        } else {
            logger.info(`Discord alert sent successfully for failed ${jobName} job.`);
        }
    } catch (err) {
        logger.error({ message: `Error sending Discord alert for ${jobName}`, error: err });
    }
}

export function startPgCronMonitor(): { stop: () => void } {
    if (intervalId) {
        logger.warn("pg_cron monitor job is already running.");
        return { stop: stopPgCronMonitor };
    }

    logger.info(`Starting pg_cron monitor loop (interval: ${CHECK_INTERVAL_MS}ms)`);

    // Initialize lastChecked to 1 hour ago for the initial run to catch any misses while server was restarting
    lastChecked = new Date(Date.now() - CHECK_INTERVAL_MS);

    // Run an initial check shortly after boot
    setTimeout(() => {
        void checkFailedPgCronJobs();
    }, 5000);

    intervalId = setInterval(() => {
        void checkFailedPgCronJobs();
    }, CHECK_INTERVAL_MS);

    return { stop: stopPgCronMonitor };
}

export function stopPgCronMonitor(): void {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        logger.info("Stopped pg_cron monitor loop");
    }
}
