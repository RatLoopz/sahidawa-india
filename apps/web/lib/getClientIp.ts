export function getClientIp(req: Request): string {
    const vercelForwardedFor = req.headers.get("x-vercel-forwarded-for");
    if (vercelForwardedFor) {
        const ips = vercelForwardedFor
            .split(",")
            .map((ip) => ip.trim())
            .filter(Boolean);
        if (ips.length > 0) {
            return ips[0]!;
        }
    }

    const realIp = req.headers.get("x-real-ip");
    if (realIp && realIp.trim()) {
        return realIp.trim();
    }

    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
        const ips = forwardedFor
            .split(",")
            .map((ip) => ip.trim())
            .filter(Boolean);
        if (ips.length > 0) {
            return ips[0]!;
        }
    }

    return "127.0.0.1";
}
