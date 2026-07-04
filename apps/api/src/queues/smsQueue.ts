import { Queue } from "bullmq";
import IORedis from "ioredis";
const connection = new IORedis(process.env.REDIS_URL as string, { maxRetriesPerRequest: null });

export const smsQueue = new Queue("sms-queue", {
    connection: connection as any,
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: "exponential",
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});
