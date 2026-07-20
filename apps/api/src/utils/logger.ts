import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { getRequestId } from "../middleware/requestId";
import fs from "fs";
import path from "path";

const logDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

// ── Custom format: inject the current request's correlation ID ─────────────
// Uses AsyncLocalStorage under the hood so existing `logger.info(…)` calls
// automatically include `requestId` — no caller changes required.
const injectRequestId = winston.format((info) => {
    const requestId = getRequestId();
    if (requestId) {
        info.requestId = requestId;
    }
    return info;
});

const SENSITIVE_KEYS = new Set([
    "authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "password",
    "token",
    "secret",
]);

function redactObj(obj: any, seen: WeakSet<any> = new WeakSet()): any {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }

    if (seen.has(obj)) {
        return "[CIRCULAR]";
    }
    seen.add(obj);

    if (Array.isArray(obj)) {
        return obj.map((item) => redactObj(item, seen));
    }

    const redacted: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if (SENSITIVE_KEYS.has(key.toLowerCase())) {
                redacted[key] = "[REDACTED]";
            } else {
                redacted[key] = redactObj(obj[key], seen);
            }
        }
    }

    // Copy symbol keys (like LEVEL, MESSAGE, SPLAT used by winston)
    const symbols = Object.getOwnPropertySymbols(obj);
    for (const sym of symbols) {
        redacted[sym] = obj[sym];
    }

    return redacted;
}

const redactSensitiveData = winston.format((info) => {
    return redactObj(info);
});

const logFormat = printf(({ level, message, timestamp, stack, requestId }) => {
    const reqIdTag = requestId ? ` [${requestId}]` : "";
    if (stack) {
        return `${timestamp} ${level}:${reqIdTag} ${message}\n${stack}`;
    }
    return `${timestamp} ${level}:${reqIdTag} ${message}`;
});

const errorTransport = new DailyRotateFile({
    filename: path.join(logDir, "error-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
    level: "error",
});

const combinedTransport = new DailyRotateFile({
    filename: path.join(logDir, "combined-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: combine(
        errors({ stack: true }),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        injectRequestId(),
        redactSensitiveData(),
        process.env.NODE_ENV === "production" ? json() : combine(colorize(), logFormat)
    ),
    transports: [new winston.transports.Console(), errorTransport, combinedTransport],
});

export default logger;
