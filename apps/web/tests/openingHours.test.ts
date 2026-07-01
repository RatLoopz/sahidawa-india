import { getOpenNowStatus, parseOpeningHours } from "../lib/openingHours";

// All assertions pin a specific instant and timezone so they're deterministic
// regardless of where/when the test suite runs.

describe("parseOpeningHours", () => {
    it("returns null for missing/empty hours", () => {
        expect(parseOpeningHours(undefined)).toBeNull();
        expect(parseOpeningHours(null)).toBeNull();
        expect(parseOpeningHours("")).toBeNull();
        expect(parseOpeningHours("   ")).toBeNull();
    });

    it("returns null for unsupported/garbled syntax", () => {
        expect(parseOpeningHours("whenever we feel like it")).toBeNull();
        expect(parseOpeningHours("Mo-Fr")).toBeNull();
        expect(parseOpeningHours("Mo-Fr 9am-6pm")).toBeNull();
    });

    it("parses 24/7", () => {
        const rules = parseOpeningHours("24/7");
        expect(rules).not.toBeNull();
        expect(rules?.[0].days.size).toBe(7);
    });

    it("parses day ranges, lists, and multiple time windows", () => {
        const rules = parseOpeningHours("Mo-Fr 09:00-13:00,14:00-18:00; Sa,Su 10:00-14:00");
        expect(rules).toHaveLength(2);
        expect(rules?.[0].ranges).toHaveLength(2);
        expect(rules?.[1].days.has(0)).toBe(true); // Su
        expect(rules?.[1].days.has(6)).toBe(true); // Sa
    });

    it("parses an off override", () => {
        const rules = parseOpeningHours("Mo-Sa 09:00-21:00; Su off");
        const sunday = rules?.find((r) => r.off);
        expect(sunday?.days.has(0)).toBe(true);
    });
});

describe("getOpenNowStatus", () => {
    const TZ = "Asia/Kolkata";

    it("is open during a simple daytime window", () => {
        // Wed 2026-07-01 12:00 IST
        const at = new Date("2026-07-01T06:30:00Z"); // 12:00 IST
        const result = getOpenNowStatus("Mo-Fr 09:00-18:00", TZ, at);
        expect(result).toEqual({ status: "open", isOpen: true });
    });

    it("is closed outside a simple daytime window", () => {
        // Wed 2026-07-01 20:00 IST
        const at = new Date("2026-07-01T14:30:00Z"); // 20:00 IST
        const result = getOpenNowStatus("Mo-Fr 09:00-18:00", TZ, at);
        expect(result).toEqual({ status: "closed", isOpen: false });
    });

    it("is closed on a day not listed in the schedule", () => {
        // Sunday 2026-07-05 12:00 IST
        const at = new Date("2026-07-05T06:30:00Z");
        const result = getOpenNowStatus("Mo-Fr 09:00-18:00", TZ, at);
        expect(result.isOpen).toBe(false);
    });

    it("handles an overnight range that wraps past midnight", () => {
        // 01:00 IST Thursday counts as still within Wed 20:00-02:00
        const lateNight = new Date("2026-07-01T19:30:00Z"); // Thu 01:00 IST
        const result = getOpenNowStatus("Mo-Fr 20:00-02:00", TZ, lateNight);
        expect(result).toEqual({ status: "open", isOpen: true });

        // Mid-afternoon should be closed for the same schedule
        const afternoon = new Date("2026-07-01T08:30:00Z"); // Wed 14:00 IST
        expect(getOpenNowStatus("Mo-Fr 20:00-02:00", TZ, afternoon).isOpen).toBe(false);
    });

    it("treats 24/7 as always open", () => {
        const at = new Date("2026-07-05T20:30:00Z"); // Sunday night IST
        expect(getOpenNowStatus("24/7", TZ, at)).toEqual({ status: "open", isOpen: true });
    });

    it("falls back to unavailable for missing hours", () => {
        const at = new Date("2026-07-01T06:30:00Z");
        expect(getOpenNowStatus(null, TZ, at)).toEqual({ status: "unavailable", isOpen: false });
        expect(getOpenNowStatus(undefined, TZ, at)).toEqual({
            status: "unavailable",
            isOpen: false,
        });
    });

    it("falls back to unavailable for invalid hours syntax", () => {
        const at = new Date("2026-07-01T06:30:00Z");
        expect(getOpenNowStatus("call us to find out", TZ, at)).toEqual({
            status: "unavailable",
            isOpen: false,
        });
    });

    it("falls back to unavailable for an unrecognised timezone", () => {
        const at = new Date("2026-07-01T06:30:00Z");
        const result = getOpenNowStatus("Mo-Fr 09:00-18:00", "Not/A_Zone", at);
        expect(result).toEqual({ status: "unavailable", isOpen: false });
    });

    it("defaults to Asia/Kolkata when no timezone is given", () => {
        const at = new Date("2026-07-01T06:30:00Z"); // 12:00 IST
        const result = getOpenNowStatus("Mo-Fr 09:00-18:00", undefined, at);
        expect(result).toEqual({ status: "open", isOpen: true });
    });
});
