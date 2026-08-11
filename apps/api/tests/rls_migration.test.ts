import { readFileSync } from "fs";
import { join } from "path";

const MIGRATIONS_DIR = join(__dirname, "..", "..", "..", "supabase", "migrations");
const MIGRATION_FILE = "20260630000000_enable_rls_tracked_medicines.sql";
const RLS_REFERENCE_FILE = "20260529000000_add_rls_policies.sql";

describe("RLS Migration — tracked_medicines", () => {
    const migrationPath = join(MIGRATIONS_DIR, MIGRATION_FILE);
    const sql = readFileSync(migrationPath, "utf8");

    it("migration file exists", () => {
        expect(sql).toBeTruthy();
    });

    it("enables RLS on tracked_medicines", () => {
        expect(sql).toContain("ALTER TABLE public.tracked_medicines ENABLE ROW LEVEL SECURITY");
    });

    it("creates owner-only policy for authenticated users", () => {
        expect(sql).toContain('CREATE POLICY "tracked_medicines_owner_only"');
        expect(sql).toContain("TO authenticated");
        expect(sql).toContain("USING (user_id = auth.uid())");
        expect(sql).toContain("WITH CHECK (user_id = auth.uid())");
    });

    it("creates service_role all-access policy", () => {
        expect(sql).toContain('CREATE POLICY "tracked_medicines_service_all"');
        expect(sql).toContain("TO service_role");
    });

    it("uses consistent policy naming with existing RLS file", () => {
        const refSql = readFileSync(join(MIGRATIONS_DIR, RLS_REFERENCE_FILE), "utf8");
        const refPattern = /CREATE POLICY "(\w+)_service_all"/;
        const refMatch = refSql.match(refPattern);
        const ourPattern = /CREATE POLICY "tracked_medicines_service_all"/;
        expect(ourPattern.test(sql)).toBe(true);
        expect(refMatch).not.toBeNull();
    });
});

describe("RLS Migration - user_scan_history owner policy", () => {
    const migrationPath = join(MIGRATIONS_DIR, "20260704150905_add_rls_to_scan_history.sql");
    const sql = readFileSync(migrationPath, "utf8");

    it("targets user_scan_history, which has user_id ownership", () => {
        expect(sql).toContain("ALTER TABLE public.user_scan_history ENABLE ROW LEVEL SECURITY");
        expect(sql).toContain("ON public.user_scan_history");
        expect(sql).not.toContain("ON public.scan_history");
    });

    it("creates an idempotent authenticated owner policy", () => {
        expect(sql).toContain(
            'DROP POLICY IF EXISTS "Users can manage their own scan history" ON public.user_scan_history'
        );
        expect(sql).toContain('CREATE POLICY "Users can manage their own scan history"');
        expect(sql).toContain("TO authenticated");
        expect(sql).toContain("USING (auth.uid() = user_id)");
        expect(sql).toContain("WITH CHECK (auth.uid() = user_id)");
    });
});

describe("RLS Migration — tracked_medicines guest policy", () => {
    const migrationPath = join(
        MIGRATIONS_DIR,
        "20260701000000_add_guest_rls_tracked_medicines.sql"
    );
    const sql = readFileSync(migrationPath, "utf8");

    it("migration file exists", () => {
        expect(sql).toBeTruthy();
    });

    it("creates guest access policy for anon users", () => {
        expect(sql).toContain('CREATE POLICY "tracked_medicines_guest_access"');
        expect(sql).toContain("TO anon");
        expect(sql).toContain("USING (");
        expect(sql).toContain(
            "session_id = current_setting('request.jwt.claims', true)::json->>'session_id'"
        );
        expect(sql).toContain("AND user_id IS NULL");
        expect(sql).toContain("WITH CHECK (");
    });
});

describe("Drug Alerts Migration — Deterministic Medicine Linking Trigger", () => {
    const migrationPath = join(MIGRATIONS_DIR, "20260720000000_fix_drug_alerts_medicine_id.sql");
    const sql = readFileSync(migrationPath, "utf8");

    it("includes ORDER BY match scoring and tie-breaker in link_drug_alert_to_medicine trigger", () => {
        expect(sql).toContain("CREATE OR REPLACE FUNCTION public.link_drug_alert_to_medicine()");
        expect(sql).toContain("ORDER BY");
        expect(sql).toContain(
            "WHEN (NEW.manufacturer IS NOT NULL AND manufacturer = NEW.manufacturer)"
        );
        expect(sql).toContain(
            "AND (NEW.reported_brand_name IS NOT NULL AND brand_name = NEW.reported_brand_name) THEN 0"
        );
        expect(sql).toContain("created_at DESC");
        expect(sql).toContain("id ASC");
    });

    it("includes deterministic ORDER BY in backfill UPDATE query", () => {
        expect(sql).toContain("UPDATE public.drug_alerts da");
        expect(sql).toContain("SET medicine_id = (");
        expect(sql).toContain("m.created_at DESC");
        expect(sql).toContain("m.id ASC");
    });

    it("includes new migration file with deterministic trigger and backfill", () => {
        const newMigrationSql = readFileSync(
            join(MIGRATIONS_DIR, "20260811220000_fix_drug_alert_medicine_linking_determinism.sql"),
            "utf8"
        );
        expect(newMigrationSql).toContain(
            "CREATE OR REPLACE FUNCTION public.link_drug_alert_to_medicine()"
        );
        expect(newMigrationSql).toContain("created_at DESC");
        expect(newMigrationSql).toContain("id ASC");
    });
});
