import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { getWebAutoInstrumentations } from "@opentelemetry/auto-instrumentations-web";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import { resourceFromAttributes } from "@opentelemetry/resources";

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
        resource: resourceFromAttributes({
            "service.name": "sahidawa-web",
        }),
        spanProcessors: [new BatchSpanProcessor(exporter)],
    });

    provider.register({
        contextManager: new ZoneContextManager(),
    });

    registerInstrumentations({
        instrumentations: [
            getWebAutoInstrumentations({
                "@opentelemetry/instrumentation-fetch": {
                    propagateTraceHeaderCorsUrls: [/localhost:4000/, /localhost:8000/],
                },
            }),
        ],
    });
};
