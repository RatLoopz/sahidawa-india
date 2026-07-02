import os
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

def setup_tracing():
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    resource = Resource.create({"service.name": "sahidawa-ml"})
    provider = TracerProvider(resource=resource)
    
    if endpoint:
        # OTLPSpanExporter uses v1/traces endpoint automatically if given the base URL 
        # but sometimes it requires explicit configuration based on the library version
        url = f"{endpoint}/v1/traces" if not endpoint.endswith("/v1/traces") else endpoint
        
        exporter = OTLPSpanExporter(endpoint=url)
        processor = BatchSpanProcessor(exporter)
        provider.add_span_processor(processor)
        
    trace.set_tracer_provider(provider)
