import { Queue } from "bullmq";
import IORedis from "ioredis";

const isTest = process.env.NODE_ENV === "test";

const connection = isTest
    ? ({} as any)
    : new IORedis(process.env.REDIS_URL as string, { maxRetriesPerRequest: null });

export const smsQueue = isTest
    ? ({
          add: async () => {},
          on: () => {},
      } as any)
    : new Queue("sms-queue", {
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
