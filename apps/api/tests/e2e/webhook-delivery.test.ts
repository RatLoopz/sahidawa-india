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
        const { data: insertData, error: insertError } = await supabase
            .from("health_schemes")
            .insert([
                {
                    name: schemeName,
                    description:
                        "Temporary scheme created for CI/Staging E2E webhook delivery test verification.",
                    coverage_details: { testId: testUUID },
                    is_active: true,
                },
            ])
            .select()
            .single();

        expect(insertError).toBeNull();
        expect(insertData).toBeTruthy();
        insertedSchemeId = insertData.id as string;

        const maxRetries = 10;
        const delayMs = 1500;
        let webhookDelivered = false;

        for (let i = 0; i < maxRetries; i++) {
            const { data: auditData, error: auditError } = await supabase
                .from("webhook_logs")
                .select("*")
                .contains("payload", { coverage_details: { testId: testUUID } })
                .maybeSingle();

            if (!auditError && auditData) {
                webhookDelivered = true;
                break;
            }

            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        expect(webhookDelivered).toBe(true);
    }, 25000);
});
