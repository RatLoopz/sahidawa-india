import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const hasCredentials =
    typeof process !== "undefined" &&
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN;

class MockRateLimit {
    async limit() {
        return { success: true, limit: 10, remaining: 9, reset: 0 };
    }
}

export const rateLimit =
    process.env.NODE_ENV === "test" || !hasCredentials
        ? (new MockRateLimit() as unknown as Ratelimit)
        : new Ratelimit({
              redis: Redis.fromEnv(),
              limiter: Ratelimit.slidingWindow(10, "60 s"),
              analytics: true,
          });
