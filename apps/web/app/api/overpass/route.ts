import { NextRequest, NextResponse } from "next/server";

const OVERPASS_MIRRORS = [
  "https://overpass.osm.ch/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

export async function POST(req: NextRequest) {
  const { query } = await req.json();

  for (const mirror of OVERPASS_MIRRORS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 seconds timeout per mirror

    try {
      const response = await fetch(mirror, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "SahiDawaApp/1.0 (https://sahidawa.org; contact@sahidawa.org)",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const data = await response.json();
      return NextResponse.json(data);
    } catch {
      clearTimeout(timeoutId);
      continue;
    }
  }

  return NextResponse.json(
    { error: "All Overpass mirrors failed" },
    { status: 503 }
  );
}