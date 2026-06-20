import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { getWebAutoInstrumentations } from "@opentelemetry/auto-instrumentations-web";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

let initialized = false;

export const initTracing = () => {
    if (typeof window === "undefined" || initialized) return;
    initialized = true;

    const exporter = new OTLPTraceExporter({
        url: process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT
            ? `${process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
            : "http://localhost:4318/v1/traces",
    });

    const provider = new WebTracerProvider({
        resource: new Resource({
            [SemanticResourceAttributes.SERVICE_NAME]: "sahidawa-web",
        }),
    });

    provider.addSpanProcessor(new BatchSpanProcessor(exporter));

    provider.register({
        contextManager: new ZoneContextManager(),
    });

    registerInstrumentations({
        instrumentations: [
            getWebAutoInstrumentations({
                // load custom configuration if needed
                "@opentelemetry/instrumentation-fetch": {
                    propagateTraceHeaderCorsUrls: [/localhost:4000/, /localhost:8000/],
                },
            }),
        ],
    });
};
