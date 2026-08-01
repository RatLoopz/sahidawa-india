import dns from "dns/promises";

/**
 * Hostname / IP-literal patterns that must never be the destination of a
 * server-side outbound request.
 *
 * `z.string().url()` only validates URL *format*, not where it points, so an
 * attacker could otherwise supply a cloud-metadata address (169.254.169.254),
 * a loopback address, or an internal service URL that gets fetched by the
 * server (SSRF). These cover loopback, the RFC 1918 private ranges,
 * link-local, carrier-grade NAT (100.64.0.0/10), IPv6 ULA, IPv6 link-local,
 * the unspecified address, and their IPv6-mapped equivalents.
 */
export const BLOCKED_OUTBOUND_URL_PATTERNS = [
    /^localhost$/i,
    /^0\./,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
    /^::$/,
    /^::1$/,
    /^f[cd][0-9a-f]{2}:/i,
    /^fe[89ab][0-9a-f]:/i,
    /^::ffff:/i,
];

/**
 * Extract an embedded IPv4 address from the trailing 32 bits of an IPv6
 * literal. Handles both IPv4-mapped (`::ffff:7f00:1`, `::ffff:127.0.0.1`) and
 * deprecated IPv4-compatible (`::7f00:1`, `::127.0.0.1`) forms, in hex or
 * dotted-decimal, so the embedded address can be re-checked against the IPv4
 * blocked patterns.
 *
 * Returns `null` for anything that is not one of these IPv6-wrapped IPv4
 * forms. The regex only matches `::`-prefixed literals, which always fall in
 * the reserved `::/8` block, so no public IPv6 address can be misclassified.
 */
function getEmbeddedIpv4(host: string): string | null {
    const match = host.match(/^::(?:ffff:)?([0-9a-f:]+)$/i);
    if (!match) return null;

    const groups = match[1].split(":").filter((group) => group !== "");
    if (groups.length === 0 || groups.length > 4) return null;

    const hex = groups.map((group) => group.padStart(4, "0")).join("");
    if (!/^[0-9a-f]{8}$/i.test(hex)) return null;

    const octets = hex.match(/[0-9a-f]{2}/gi)!.map((octet) => parseInt(octet, 16));
    return octets.join(".");
}

export function isBlockedOutboundHost(host: string): boolean {
    if (BLOCKED_OUTBOUND_URL_PATTERNS.some((pattern) => pattern.test(host))) return true;

    const embeddedIpv4 = getEmbeddedIpv4(host);
    if (embeddedIpv4 !== null) {
        return BLOCKED_OUTBOUND_URL_PATTERNS.some((pattern) => pattern.test(embeddedIpv4));
    }

    return false;
}

/**
 * Hard cap on how long a DNS lookup is allowed to take. Without this a slow or
 * malicious resolver could hang the request indefinitely (DoS). Configurable
 * via `DNS_LOOKUP_TIMEOUT_MS` so tests can shorten it.
 */
const DNS_TIMEOUT_MS = parseInt(process.env.DNS_LOOKUP_TIMEOUT_MS ?? "3000", 10);

/**
 * Validates that `rawUrl` is safe to fetch from the server.
 *
 * Returns `true` only when the URL uses http(s), its hostname is not in a
 * blocked range, and the address it resolves to is also not in a blocked range
 * (so a public hostname that resolves to an internal IP is still rejected).
 * Any parse error, DNS failure, or DNS timeout resolves to `false` — the URL
 * is treated as unsafe by default.
 */
export async function validateOutboundUrl(rawUrl: string): Promise<boolean> {
    let timeoutHandle: NodeJS.Timeout | undefined;
    try {
        const { protocol, hostname } = new URL(rawUrl);
        if (protocol !== "https:" && protocol !== "http:") return false;

        // Strip the brackets around IPv6 literals (e.g. "[::1]" -> "::1").
        const normalizedHost = hostname.replace(/^\[|\]$/g, "");
        if (isBlockedOutboundHost(normalizedHost)) return false;

        // Race the DNS lookup against a hard timeout so a slow resolver can't
        // hang the request.
        const { address } = (await Promise.race([
            dns.lookup(normalizedHost),
            new Promise<never>((_, reject) => {
                timeoutHandle = setTimeout(
                    () => reject(new Error("DNS lookup timeout")),
                    DNS_TIMEOUT_MS
                );
            }),
        ])) as { address: string };

        if (isBlockedOutboundHost(address)) return false;

        return true;
    } catch {
        // Parse errors, DNS failures, and timeouts all mean "not verified safe".
        return false;
    } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
    }
}
