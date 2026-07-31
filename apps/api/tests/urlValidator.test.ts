process.env.DNS_LOOKUP_TIMEOUT_MS = process.env.DNS_LOOKUP_TIMEOUT_MS || "50";

import dns from "dns/promises";
import {
    validateOutboundUrl,
    BLOCKED_OUTBOUND_URL_PATTERNS,
    isBlockedOutboundHost,
} from "../src/utils/security/urlValidator";

jest.mock("dns/promises", () => ({
    lookup: jest.fn(),
}));

const mockedLookup = dns.lookup as jest.MockedFunction<typeof dns.lookup>;

describe("validateOutboundUrl", () => {
    beforeEach(() => {
        // Default: hostname resolves to a public address.
        mockedLookup.mockResolvedValue({ address: "8.8.8.8", family: 4 } as any);
    });

    it("accepts a public https URL", async () => {
        await expect(validateOutboundUrl("https://res.cloudinary.com/x.jpg")).resolves.toBe(true);
    });

    it("accepts a public http URL", async () => {
        await expect(validateOutboundUrl("http://example.com/a.png")).resolves.toBe(true);
    });

    it("rejects non-http(s) protocols without doing a lookup", async () => {
        await expect(validateOutboundUrl("ftp://example.com/a.png")).resolves.toBe(false);
        await expect(validateOutboundUrl("file:///etc/passwd")).resolves.toBe(false);
        expect(mockedLookup).not.toHaveBeenCalled();
    });

    it("rejects a malformed URL", async () => {
        await expect(validateOutboundUrl("not a url")).resolves.toBe(false);
    });

    it.each([
        "http://localhost/x",
        "http://0.0.0.0/x",
        "http://127.0.0.1/x",
        "http://10.0.0.5/x",
        "http://172.16.0.1/x",
        "http://192.168.1.1/x",
        "http://169.254.169.254/latest/meta-data",
        "http://100.64.0.1/x",
        "http://100.127.255.254/x",
        "http://[::]/x",
        "http://[::1]/x",
        "http://[::ffff:7f00:1]/x",
        "http://[::ffff:127.0.0.1]/x",
        "http://[::7f00:1]/x",
        "http://[::127.0.0.1]/x",
        "http://[fc00::1]/x",
        "http://[fc01::1]/x",
        "http://[fd00::1]/x",
        "http://[fe80::1]/x",
        "http://[fe81::1]/x",
        "http://[fea0::1]/x",
        "http://[febf::1]/x",
    ])("rejects blocked literal host %s before lookup", async (url) => {
        await expect(validateOutboundUrl(url)).resolves.toBe(false);
        expect(mockedLookup).not.toHaveBeenCalled();
    });

    it("rejects an IPv6 literal that embeds a private IPv4 (e.g. ::10.0.0.1)", async () => {
        expect(isBlockedOutboundHost("::a00:1")).toBe(true);
        expect(isBlockedOutboundHost("::ffff:7f00:1")).toBe(true);
    });

    it("accepts boundary addresses just outside the blocked ranges", async () => {
        await expect(validateOutboundUrl("http://100.63.255.255/x")).resolves.toBe(true);
        await expect(validateOutboundUrl("http://100.128.0.1/x")).resolves.toBe(true);
        await expect(validateOutboundUrl("http://8.8.8.8/x")).resolves.toBe(true);
        await expect(validateOutboundUrl("http://[2001:4860:4860::8888]/x")).resolves.toBe(true);
        await expect(validateOutboundUrl("http://[fec0::1]/x")).resolves.toBe(true);
    });

    it("rejects a public hostname that resolves to a private address", async () => {
        mockedLookup.mockResolvedValue({ address: "169.254.169.254", family: 4 } as any);
        await expect(validateOutboundUrl("https://evil.example.com/x.jpg")).resolves.toBe(false);
    });

    it("rejects when the DNS lookup rejects", async () => {
        mockedLookup.mockRejectedValue(new Error("ENOTFOUND"));
        await expect(validateOutboundUrl("https://nope.example.com/x.jpg")).resolves.toBe(false);
    });

    it("rejects when the DNS lookup exceeds the timeout", async () => {
        // A lookup that never settles — the internal DNS timeout must win.
        mockedLookup.mockImplementation(() => new Promise(() => {}));
        await expect(validateOutboundUrl("https://slow.example.com/x.jpg")).resolves.toBe(false);
    });

    it("exposes the blocked-pattern list for reuse", () => {
        expect(BLOCKED_OUTBOUND_URL_PATTERNS.some((p) => p.test("127.0.0.1"))).toBe(true);
        expect(BLOCKED_OUTBOUND_URL_PATTERNS.some((p) => p.test("8.8.8.8"))).toBe(false);
        expect(BLOCKED_OUTBOUND_URL_PATTERNS.some((p) => p.test("100.64.0.1"))).toBe(true);
        expect(BLOCKED_OUTBOUND_URL_PATTERNS.some((p) => p.test("100.63.255.255"))).toBe(false);
        expect(BLOCKED_OUTBOUND_URL_PATTERNS.some((p) => p.test("fd00::1"))).toBe(true);
        expect(BLOCKED_OUTBOUND_URL_PATTERNS.some((p) => p.test("fe81::1"))).toBe(true);
        expect(BLOCKED_OUTBOUND_URL_PATTERNS.some((p) => p.test("fec0::1"))).toBe(false);
    });
});
