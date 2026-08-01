import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import logger from "./utils/logger";

if (process.env.NODE_ENV !== "production" || process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    const traceExporter = new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
            ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
            : "http://localhost:4318/v1/traces",
    });

    const sdk = new NodeSDK({
        traceExporter,
        instrumentations: [getNodeAutoInstrumentations()],
        serviceName: "sahidawa-api",
    });

    sdk.start();
    logger.info("OpenTelemetry tracing initialized");

    process.on("SIGTERM", () => {
        sdk.shutdown()
            .then(() => logger.info("Tracing terminated"))
            .catch((error) => logger.error("Error terminating tracing", { error: String(error) }))
            .finally(() => process.exit(0));
    });
}
