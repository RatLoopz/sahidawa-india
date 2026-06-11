import { NextRequest, NextResponse } from "next/server";

const OVERPASS_MIRRORS = [
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
];

export async function POST(req: NextRequest) {
    try {
        const { query } = await req.json();

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
