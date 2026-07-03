/**
 * scripts/backfill_medicine_embeddings.ts
 *
 * One-shot script that populates the `embedding` column on the `medicines`
 * table for every row where it is currently NULL.
 *
 * Usage:
 *   GEMINI_API_KEY=<key> SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> \
 *     npx ts-node --project tsconfig.json scripts/backfill_medicine_embeddings.ts
 *
 * Required env vars:
 *   GEMINI_API_KEY            – Google Generative Language API key
 *   SUPABASE_URL              – Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY – Service-role key (bypasses RLS so we can write embeddings)
 *
 * Optional env vars:
 *   BATCH_SIZE  – rows per page (default: 50)
 *   DRY_RUN     – set to "true" to skip the DB write (just logs what would happen)
 */

import { createClient } from "@supabase/supabase-js";

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim() ?? "";
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? "50");
const DRY_RUN = process.env.DRY_RUN === "true";

const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;
const EMBEDDING_DIMENSIONS = 768;
const EMBEDDING_TIMEOUT_MS = 8000;

// ── Guards ────────────────────────────────────────────────────────────────────

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
    process.exit(1);
}
if (!GEMINI_API_KEY) {
    console.error("❌  GEMINI_API_KEY must be set.");
    process.exit(1);
}

// ── Supabase client (service-role, bypasses RLS) ──────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Calls the Google text-embedding-004 REST endpoint. Returns null on failure. */
async function embedText(text: string): Promise<number[] | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

    try {
        const res = await fetch(`${EMBEDDING_ENDPOINT}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: `models/${EMBEDDING_MODEL}`,
                content: { parts: [{ text }] },
            }),
            signal: controller.signal,
        });

        if (!res.ok) {
            console.warn(`  ⚠️  Embedding API responded ${res.status}`);
            return null;
        }

        const body = (await res.json()) as { embedding?: { values?: unknown } };
        const values = body?.embedding?.values;

        if (
            Array.isArray(values) &&
            values.length === EMBEDDING_DIMENSIONS &&
            values.every((v) => typeof v === "number")
        ) {
            return values as number[];
        }

        console.warn("  ⚠️  Unexpected embedding response shape");
        return null;
    } catch (err) {
        console.warn("  ⚠️  Embedding request failed:", err instanceof Error ? err.message : err);
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

/** Builds the monograph text that gets embedded (mirrors buildMedicineMonograph). */
function buildMonograph(row: {
    brand_name: string | null;
    generic_name: string;
    strength: string | null;
    dosage_form: string | null;
    composition: string | null;
    manufacturer: string | null;
    schedule: string | null;
}): string {
    const parts: string[] = [];
    const name = row.brand_name?.trim()
        ? `${row.brand_name.trim()} (${row.generic_name.trim()})`
        : row.generic_name.trim();
    parts.push(name);
    if (row.strength?.trim()) parts.push(`Strength: ${row.strength.trim()}`);
    if (row.dosage_form?.trim()) parts.push(`Form: ${row.dosage_form.trim()}`);
    if (row.composition?.trim()) parts.push(`Composition: ${row.composition.trim()}`);
    if (row.manufacturer?.trim()) parts.push(`Manufacturer: ${row.manufacturer.trim()}`);
    if (row.schedule?.trim()) parts.push(`Schedule: ${row.schedule.trim()}`);
    return parts.join(". ");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
    console.log(
        `🚀  Medicine embedding backfill started (DRY_RUN=${DRY_RUN}, BATCH_SIZE=${BATCH_SIZE})`
    );

    let offset = 0;
    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    while (true) {
        // Fetch a batch of rows without embeddings
        const { data: rows, error } = await supabase
            .from("medicines")
            .select(
                "id, brand_name, generic_name, strength, dosage_form, composition, manufacturer, schedule"
            )
            .is("embedding", null)
            .range(offset, offset + BATCH_SIZE - 1);

        if (error) {
            console.error("❌  Failed to fetch medicines:", error.message);
            process.exit(1);
        }

        if (!rows || rows.length === 0) {
            console.log("✅  No more rows to process.");
            break;
        }

        console.log(`\n📦  Batch at offset ${offset} — ${rows.length} rows`);

        const updates: { id: string; embedding: number[] }[] = [];

        for (const row of rows) {
            const monograph = buildMonograph(row);
            if (!monograph.trim()) {
                console.log(`  ⏭️  Skipping row ${row.id} (empty monograph)`);
                totalSkipped++;
                continue;
            }

            const embedding = await embedText(monograph);
            if (!embedding) {
                console.log(`  ❌  Failed to embed row ${row.id}`);
                totalFailed++;
                continue;
            }

            updates.push({ id: row.id, embedding });
            console.log(`  ✔  Embedded row ${row.id}`);
        }

        if (updates.length > 0 && !DRY_RUN) {
            const { error: upsertError } = await supabase.from("medicines").upsert(
                updates.map((u) => ({ id: u.id, embedding: u.embedding })),
                { onConflict: "id" }
            );

            if (upsertError) {
                console.error("❌  Upsert failed:", upsertError.message);
                totalFailed += updates.length;
            } else {
                console.log(`  💾  Wrote ${updates.length} embeddings to DB`);
                totalProcessed += updates.length;
            }
        } else if (DRY_RUN) {
            console.log(`  🔍  DRY_RUN — would have written ${updates.length} embeddings`);
            totalProcessed += updates.length;
        }

        // If the batch was smaller than BATCH_SIZE we've hit the end
        if (rows.length < BATCH_SIZE) break;

        offset += BATCH_SIZE;
    }

    console.log(
        `\n🏁  Done — processed: ${totalProcessed}, skipped: ${totalSkipped}, failed: ${totalFailed}`
    );
}

run().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
