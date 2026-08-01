import * as Sentry from "@sentry/node";
import { sanitize } from "./utils/security/sanitize";
import logger from "./utils/logger";

const isEnabled = Boolean(process.env.SENTRY_DSN) && process.env.NODE_ENV === "production";

if (isEnabled) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV,
        // No tracesSampleRate/profilesSampleRate/integrations here —
        // tracing.ts already owns full APM via OpenTelemetry auto-instrumentation.
        // Sentry is scoped to error capture only, to avoid duplicate spans.
        beforeSend(event) {
            // Reuse the same redaction policy as errorHandler.ts so we never
            // ship secrets to Sentry that we already strip from local logs.
            if (event.request?.data && typeof event.request.data === "object") {
                event.request.data = sanitize(event.request.data as Record<string, unknown>);
            }
            return event;
        },
    });
    logger.info("Sentry initialized for sahidawa-api");
} else {
    logger.info("Sentry disabled (SENTRY_DSN not set or not in production)");
}

export { isEnabled as sentryEnabled };
