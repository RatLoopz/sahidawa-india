// @ts-ignore - optional dependency
import { NodeSDK } from "@opentelemetry/sdk-node";
// @ts-ignore - optional dependency
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
// @ts-ignore - optional dependency
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

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

process.on("SIGTERM", () => {
    sdk.shutdown()
        .then(() => console.log("Tracing terminated"))
        .catch((error: unknown) => console.log("Error terminating tracing", error))
        .finally(() => process.exit(0));
});
