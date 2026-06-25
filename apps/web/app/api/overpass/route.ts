import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

const OVERPASS_MIRRORS = [
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
];

const MAX_QUERY_LENGTH = 10000;

export async function POST(req: NextRequest) {
    try {
        const forwardedFor = req.headers.get("x-forwarded-for");
        const realIp = req.headers.get("x-real-ip");
        const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "127.0.0.1";

        const { success } = await rateLimit.limit(ip);
        if (!success) {
            return NextResponse.json(
                { error: "Too many requests. Please try again in a few moments." },
                { status: 429 }
            );
        }

        let body;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { query } = body;

        if (typeof query !== "string" || query.trim() === "") {
            return NextResponse.json({ error: "Missing or invalid query" }, { status: 400 });
        }

        if (query.length > MAX_QUERY_LENGTH) {
            return NextResponse.json({ error: "Query exceeds maximum length" }, { status: 400 });
        }

        // Query all mirrors in parallel (race them) for maximum speed and zero timeout chaining
        const controllers: AbortController[] = [];
        const fetchPromises = OVERPASS_MIRRORS.map(async (mirror) => {
            const controller = new AbortController();
            controllers.push(controller);
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout per mirror

            try {
                const response = await fetch(mirror, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        Accept: "*/*",
                        "User-Agent":
                            "SahiDawaApp/1.0 (https://sahidawa.org; contact@sahidawa.org)",
                    },
                    body: `data=${encodeURIComponent(query)}`,
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`Mirror ${mirror} returned status ${response.status}`);
                }

                const data = await response.json();
                if (!data || !data.elements) {
                    throw new Error(`Mirror ${mirror} returned invalid data structure`);
                }

                return data;
            } catch (err) {
                clearTimeout(timeoutId);
                throw err;
            }
        });

        // Promise.any returns the first successfully resolved promise
        const fastestData = await Promise.any(fetchPromises);
        // Abort remaining in-flight requests now that we have a result
        for (const c of controllers) {
            if (!c.signal.aborted) c.abort();
        }
        return NextResponse.json(fastestData);
    } catch {
        return NextResponse.json(
            { error: "All parallel Overpass mirrors failed" },
            { status: 503 }
        );
    }
}
