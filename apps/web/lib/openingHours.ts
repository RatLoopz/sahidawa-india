/**
 * Open Now evaluation for the Pharmacy & ASHA Map (#2862).
 *
 * Pharmacy hours are stored using the OSM `opening_hours` syntax (the same
 * format already returned by the Overpass API for OSM-sourced pharmacies —
 * see overpassApi.ts), e.g.:
 *
 *   "24/7"
 *   "Mo-Sa 09:00-21:00"
 *   "Mo-Fr 09:00-13:00,14:00-18:00; Sa 09:00-13:00; Su off"
 *   "Mo-Fr 20:00-02:00"   (overnight - closes after midnight)
 *
 * This module implements a deliberately small, well-tested subset of the
 * full OSM spec (https://wiki.openstreetmap.org/wiki/Key:opening_hours) —
 * day ranges/lists, comma-separated time ranges, overnight wraparound,
 * `24/7`, and `off`/`closed` overrides. Anything outside that subset is
 * treated as "unavailable" rather than guessed at, per the issue's fallback
 * requirement.
 */

export type OpenNowStatus = "open" | "closed" | "unavailable";

export interface OpenNowResult {
    status: OpenNowStatus;
    /** True only when status === "open" — convenience for filter predicates. */
    isOpen: boolean;
}

const DAY_TOKENS: Record<string, number> = {
    su: 0,
    mo: 1,
    tu: 2,
    we: 3,
    th: 4,
    fr: 5,
    sa: 6,
};

interface TimeRange {
    startMin: number; // minutes since local midnight
    endMin: number; // may exceed 1440 for overnight ranges
}

interface DayRule {
    days: Set<number>; // 0=Sun..6=Sat
    off: boolean;
    ranges: TimeRange[];
}

function parseTimeToMinutes(raw: string): number | null {
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(raw.trim());
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function parseDayToken(token: string): number | null {
    const key = token.trim().toLowerCase().slice(0, 2);
    return key in DAY_TOKENS ? DAY_TOKENS[key] : null;
}

function expandDayRange(token: string): Set<number> | null {
    const days = new Set<number>();
    for (const part of token.split(",")) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        if (trimmed.includes("-")) {
            const [fromRaw, toRaw] = trimmed.split("-").map((s) => s.trim());
            const from = parseDayToken(fromRaw);
            const to = parseDayToken(toRaw);
            if (from === null || to === null) return null;
            let cursor = from;
            // Walk forward, wrapping (e.g. Fr-Mo)
            while (true) {
                days.add(cursor);
                if (cursor === to) break;
                cursor = (cursor + 1) % 7;
            }
        } else {
            const day = parseDayToken(trimmed);
            if (day === null) return null;
            days.add(day);
        }
    }
    return days.size > 0 ? days : null;
}

function parseTimeRanges(token: string): TimeRange[] | null {
    const ranges: TimeRange[] = [];
    for (const part of token.split(",")) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const [startRaw, endRaw] = trimmed.split("-").map((s) => s.trim());
        if (!startRaw || !endRaw) return null;
        const startMin = parseTimeToMinutes(startRaw);
        let endMin = parseTimeToMinutes(endRaw);
        if (startMin === null || endMin === null) return null;
        if (endMin <= startMin) endMin += 24 * 60; // overnight wraparound
        ranges.push({ startMin, endMin });
    }
    return ranges.length > 0 ? ranges : null;
}

/**
 * Parses an OSM-style opening_hours string into day rules.
 * Returns null if the string is empty, "off"-everything, or uses syntax
 * outside the supported subset — callers should treat that as unavailable.
 */
export function parseOpeningHours(raw: string | null | undefined): DayRule[] | null {
    if (!raw) return null;
    const value = raw.trim();
    if (!value) return null;

    if (/^24\/7$/i.test(value)) {
        return [
            {
                days: new Set([0, 1, 2, 3, 4, 5, 6]),
                off: false,
                ranges: [{ startMin: 0, endMin: 24 * 60 }],
            },
        ];
    }

    const rules: DayRule[] = [];
    for (const segment of value.split(";")) {
        const trimmed = segment.trim();
        if (!trimmed) continue;

        const tokens = trimmed.split(/\s+/);
        if (tokens.length < 2) return null;

        const dayToken = tokens[0];
        const rest = tokens.slice(1).join(" ");

        const days = expandDayRange(dayToken);
        if (!days) return null;

        if (/^(off|closed)$/i.test(rest)) {
            rules.push({ days, off: true, ranges: [] });
            continue;
        }

        const ranges = parseTimeRanges(rest);
        if (!ranges) return null;

        rules.push({ days, off: false, ranges });
    }

    return rules.length > 0 ? rules : null;
}

/**
 * Evaluates whether a pharmacy is open at `at` (defaults to now), in the
 * pharmacy's local timezone (IANA name, e.g. "Asia/Kolkata"). Falls back to
 * "unavailable" for missing/invalid hours or unrecognised timezones, per
 * the issue's fallback requirement (#2862) — callers should exclude or
 * label these consistently rather than guessing.
 */
export function getOpenNowStatus(
    operatingHours: string | null | undefined,
    timezone: string | null | undefined,
    at: Date = new Date()
): OpenNowResult {
    const rules = parseOpeningHours(operatingHours);
    if (!rules) return { status: "unavailable", isOpen: false };

    const tz = timezone && timezone.trim() ? timezone.trim() : "Asia/Kolkata";

    let parts: Intl.DateTimeFormatPart[];
    try {
        parts = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
        }).formatToParts(at);
    } catch {
        // Unknown/invalid IANA timezone — treat as unavailable rather than guess.
        return { status: "unavailable", isOpen: false };
    }

    const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "";
    const hourStr = parts.find((p) => p.type === "hour")?.value ?? "";
    const minuteStr = parts.find((p) => p.type === "minute")?.value ?? "";

    const todayDow = parseDayToken(weekdayStr);
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    if (todayDow === null || Number.isNaN(hour) || Number.isNaN(minute)) {
        return { status: "unavailable", isOpen: false };
    }

    const nowMin = hour * 60 + minute;
    const yesterdayDow = (todayDow + 6) % 7;

    for (const rule of rules) {
        if (rule.off) continue;
        if (!rule.days.has(todayDow)) continue;
        for (const range of rule.ranges) {
            if (nowMin >= range.startMin && nowMin < range.endMin) {
                return { status: "open", isOpen: true };
            }
        }
    }

    // Check overnight ranges that started yesterday and roll past midnight.
    for (const rule of rules) {
        if (rule.off) continue;
        if (!rule.days.has(yesterdayDow)) continue;
        for (const range of rule.ranges) {
            if (range.endMin <= 24 * 60) continue; // not an overnight range
            const wrappedMin = nowMin + 24 * 60;
            if (wrappedMin >= range.startMin && wrappedMin < range.endMin) {
                return { status: "open", isOpen: true };
            }
        }
    }

    return { status: "closed", isOpen: false };
}
