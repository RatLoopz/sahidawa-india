export interface LogEntry {
    log_level: "info" | "warn" | "error";
    route: string;
    latency_ms?: number;
    metrics?: {
        input_tokens: number | undefined;
        output_tokens: number | undefined;
    };
    error?: {
        message: string;
        code: number;
        stack: string | undefined;
    };
    meta?: Record<string, unknown>;
}

export function structuredLog(entry: LogEntry): void {
    const logData = {
        timestamp: new Date().toISOString(),
        ...entry,
    };
    const line = JSON.stringify(logData);
    if (entry.log_level === "error") {
        console.error(line);
    } else if (entry.log_level === "warn") {
        console.warn(line);
    } else {
        console.log(line);
    }
}
