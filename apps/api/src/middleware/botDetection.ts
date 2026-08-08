/**
 * Bot Detection Middleware
 *
 * Analyses request timing regularity, User-Agent patterns, and a request
 * fingerprint to decide whether a client is likely an automated bot.
 *
 * Detected bots receive a stricter rate limit (halved max) and are
 * flagged in the request context so downstream middleware can act on it.
 *
 * The detection is deliberately lightweight — no ML, no external
 * services — so it runs on every request without measurable latency.
 */

import { Request, Response, NextFunction } from "express";
import { redisClient } from "../utils/redis";
import logger from "../utils/logger";

// ── Suspicious User-Agent substrings ─────────────────────────────────────────
const BOT_UA_PATTERNS = [
    /python-requests/i,
    /python-urllib/i,
    /go-http-client/i,
    /curl/i,
    /wget/i,
    /scrapy/i,
    /selenium/i,
    /headless/i,
    /phantomjs/i,
    /puppeteer/i,
    /playwright/i,
    /httpclient/i,
    /java\//i,
    /okhttp/i,
    /axios\/node/i,
    /node-fetch/i,
    /undici/i,
];

// ── Timing regularity detection ──────────────────────────────────────────────
// Humans have high inter-request timing variance; bots are regular.
// We store the last 10 inter-request deltas and compute coefficient of
// variation (stddev / mean).  A CV < 0.15 is flagged as bot-like.

const TIMING_WINDOW = 10;
const CV_THRESHOLD = 0.15;

interface TimingEntry {
    deltas: number[];
    lastRequest: number;
}

// In-process timing store (keyed by IP).  Lightweight — only timestamps.
const timingStore = new Map<string, TimingEntry>();

// Periodic cleanup to prevent unbounded growth
setInterval(() => {
    const cutoff = Date.now() - 10 * 60 * 1000; // 10 minutes idle → evict
    for (const [ip, entry] of timingStore) {
        if (entry.lastRequest < cutoff) timingStore.delete(ip);
    }
}, 60_000).unref();

// ── Request fingerprinting ───────────────────────────────────────────────────
function fingerprint(req: Request): string {
    return [
        req.headers["accept-language"] ?? "",
        req.headers["accept-encoding"] ?? "",
        req.headers["sec-ch-ua"] ?? "",
        req.headers["sec-ch-ua-platform"] ?? "",
    ].join("|");
}

// ── Main middleware factory ──────────────────────────────────────────────────
export interface BotDetectionOptions {
    /** If true, block detected bots outright (default: false — just flag) */
    blockBots?: boolean;
}

export function botDetection(options: BotDetectionOptions = {}) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        if (process.env.NODE_ENV === "test") return next();

        const ua = req.headers["user-agent"] ?? "";
        const ip = req.ip ?? "unknown";
        const score = { ua: 0, timing: 0, fingerprint: 0 };

        // 1. User-Agent heuristic
        if (!ua || ua.length < 10) {
            score.ua += 30; // missing or very short UA
        }
        for (const pattern of BOT_UA_PATTERNS) {
            if (pattern.test(ua)) {
                score.ua += 40;
                break;
            }
        }

        // 2. Timing regularity
        const now = Date.now();
        const entry = timingStore.get(ip);
        if (entry) {
            const delta = now - entry.lastRequest;
            if (entry.deltas.length >= 2) {
                entry.deltas.push(delta);
                if (entry.deltas.length > TIMING_WINDOW) entry.deltas.shift();

                const mean = entry.deltas.reduce((a, b) => a + b, 0) / entry.deltas.length;
                const variance =
                    entry.deltas.reduce((sum, d) => sum + (d - mean) ** 2, 0) / entry.deltas.length;
                const stddev = Math.sqrt(variance);
                const cv = mean > 0 ? stddev / mean : 0;

                if (cv < CV_THRESHOLD && entry.deltas.length >= TIMING_WINDOW) {
                    score.timing += 35;
                }
            }
            entry.lastRequest = now;
        } else {
            timingStore.set(ip, { deltas: [], lastRequest: now });
        }

        // 3. Fingerprint consistency
        const fp = fingerprint(req);
        const fpKey = `bot:fp:${ip}`;
        if (redisClient.isOpen) {
            try {
                const prevFp = await redisClient.get(fpKey);
                if (prevFp !== null && prevFp === fp) {
                    score.fingerprint += 10; // same fingerprint = slightly bot-like
                }
            } catch {
                // Redis GET failure — fail open, treat as no previous fingerprint
            }
            // Store current fingerprint for next request comparison (fire-and-forget)
            redisClient.setEx(fpKey, 3600, fp).catch(() => {});
        }

        // Aggregate
        const totalScore = score.ua + score.timing + score.fingerprint;
        const isBot = totalScore >= 50;

        // Attach to request context for downstream use
        (req as any).botScore = totalScore;
        (req as any).isLikelyBot = isBot;

        if (isBot) {
            logger.debug("[botDetection] Bot detected", {
                ip,
                ua: ua.slice(0, 80),
                score,
                totalScore,
            });
        }

        if (isBot && options.blockBots) {
            res.status(403).json({
                error: "Access denied. Automated requests are not allowed.",
            });
            return;
        }

        next();
    };
}
