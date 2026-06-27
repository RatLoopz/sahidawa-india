import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const hasCredentials =
    typeof process !== "undefined" &&
    Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

class MockRateLimit {
    async limit() {
        if (!hasCredentials && process.env.NODE_ENV === "production") {
            throw new Error(
                "Missing Upstash Redis rate limit configuration in production. " +
                    "Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN."
            );
        }
        return { success: true, limit: 10, remaining: 9, reset: 0 };
    }
}

export const rateLimit = hasCredentials
    ? new Ratelimit({
          redis: Redis.fromEnv(),
          limiter: Ratelimit.slidingWindow(10, "60 s"),
          analytics: true,
      })
    : (new MockRateLimit() as unknown as Ratelimit);
