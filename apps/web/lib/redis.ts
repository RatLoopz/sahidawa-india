import { Redis } from "@upstash/redis";

const hasCredentials =
    typeof process !== "undefined" &&
    Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

export const redis = hasCredentials
    ? Redis.fromEnv()
    : ({
          get: async () => null,
          set: async () => "OK",
      } as unknown as Redis);
