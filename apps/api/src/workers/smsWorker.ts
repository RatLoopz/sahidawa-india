import IORedis from "ioredis";
import { Worker, Job } from "bullmq";
import logger from "../utils/logger";
import { isLocalDevelopment } from "../utils/env";

/**
 * Process a single "send-sms" job.
 *
 * Throws on any failure (missing credentials outside local development, rate
 * limit, provider error) so BullMQ retries the job with its configured
 * exponential backoff. Resolving without a real delivery is only allowed in
 * local development, where missing credentials are mocked.
 */
export async function processSmsJob(job: Job): Promise<void> {
    const { phone, message, language } = job.data;

    logger.info(`[SMS][${language}] Processing job for ${phone}`);

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
        if (isLocalDevelopment()) {
            logger.warn(`Twilio credentials missing. MOCKING SMS delivery to ${phone}.`);
            return;
        }
        throw new Error(`Twilio credentials missing. SMS delivery to ${phone} failed.`);
    }

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const params = new URLSearchParams();
    params.append("To", phone);
    params.append("From", fromNumber);
    params.append("Body", message);

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
    });

    if (response.ok) {
        logger.info(`Twilio SMS sent successfully to ${phone}`);
        return;
    }

    if (response.status === 429) {
        throw new Error("Twilio rate limited");
    }

    const errText = await response.text();
    throw new Error(`Twilio SMS API error: ${response.status} ${errText}`);
}

let worker: Worker | null = null;
let connection: IORedis | null = null;

export function startSmsWorker(): { stop: () => Promise<void> } {
    if (process.env.NODE_ENV === "test") {
        logger.info("SMS Worker disabled in test environment.");
        return { stop: async () => {} };
    }

    if (worker) {
        logger.warn("SMS Worker already started.");
        return { stop: async () => {} };
    }

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        throw new Error("REDIS_URL is required to start the SMS Worker.");
    }

    connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    worker = new Worker(
        "sms-queue",
        async (job: Job) => {
            await processSmsJob(job);
        },
        {
            connection: connection as any,
        }
    );

    worker.on("failed", (failedJob, error) => {
        logger.error(
            `SMS Worker job failed for ${failedJob.id}: ${error?.message ?? error}`
        );
    });

    logger.info("SMS Worker started");

    return {
        stop: async () => {
            if (worker) {
                await worker.close();
                worker = null;
            }
            if (connection) {
                connection.disconnect();
                connection = null;
            }
            logger.info("SMS Worker stopped");
        },
    };
}
