import { supabase } from "../../src/db/client";
import crypto from "crypto";

describe("E2E Webhook Delivery Verification", () => {
    const testUUID = crypto.randomUUID();
    const schemeName = `E2E_Test_Scheme_${testUUID}`;
    let insertedSchemeId: string | null = null;

    afterAll(async () => {
        if (insertedSchemeId) {
            await supabase.from("health_schemes").delete().eq("id", insertedSchemeId);
        }
    });

    it("should successfully trigger and deliver a webhook upon record insertion in health_schemes", async () => {
        console.log("Supabase URL:", process.env.SUPABASE_URL);
        console.log("Service Key:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "EXISTS" : "MISSING");

        const { data: insertData, error: insertError } = await supabase
            .from("health_schemes")
            .insert([
                {
                    state_name: "Test State",
                    scheme_name: schemeName,
                    description:
                        "Temporary scheme created for CI/Staging E2E webhook delivery test verification.",
                    coverage: "Test coverage details",
                    how_to_apply: "Test process",
                    link: "http://example.com",
                },
            ])
            .select()
            .single();

        if (insertError) {
            console.error("Insert error:", insertError);
            console.error("Error code:", insertError.code);
            console.error("Error details:", {
                message: insertError.message,
                hint: (insertError as any).hint,
                details: (insertError as any).details,
            });
        }

        expect(insertError).toBeNull();
        expect(insertData).toBeTruthy();
        insertedSchemeId = (insertData as { id: string }).id;

        const maxRetries = 10;
        const delayMs = 1500;
        let webhookDelivered = false;

        for (let i = 0; i < maxRetries; i++) {
            const { data: auditData, error: auditError } = await supabase
                .from("webhook_logs")
                .select("*")
                .contains("payload", { scheme_name: schemeName })
                .maybeSingle();

            if (auditError) {
                console.error(`Audit query error on attempt ${i + 1}:`, auditError);
            }

            if (!auditError && auditData) {
                webhookDelivered = true;
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        expect(webhookDelivered).toBe(true);
    }, 25000);
});
