import { supabase } from "../src/db/client";
import { encryptToken, decryptToken } from "../src/services/abha.service";
import logger from "../src/utils/logger";

const oldSecret = process.env.OLD_ABDM_SECRET;
const newSecret = process.env.NEW_ABDM_SECRET;

async function main() {
    if (!oldSecret || !newSecret) {
        logger.error("Both OLD_ABDM_SECRET and NEW_ABDM_SECRET must be set in the environment.");
        process.exit(1);
    }

    logger.info("Starting ABHA secret rotation process.");

    let offset = 0;
    const limit = 100;
    let totalUpdated = 0;

    while (true) {
        const { data: records, error } = await supabase
            .from("abha_links")
            .select("user_id, encrypted_token, encryption_iv, encryption_salt")
            .range(offset, offset + limit - 1);

        if (error) {
            logger.error(`Error fetching records: ${error.message}`);
            process.exit(1);
        }

        if (!records || records.length === 0) {
            break;
        }

        const updatedRecords = [];

        for (const record of records) {
            try {
                // Ensure salt and iv are retrieved as strings, some db drivers might return arrays if they were raw bytes,
                // but our app stores them as strings (hex encoded) based on abha.service.ts
                const decryptedToken = decryptToken(
                    record.encrypted_token,
                    record.encryption_iv,
                    record.encryption_salt,
                    oldSecret
                );

                const { encryptedToken, iv, salt } = encryptToken(decryptedToken, newSecret);

                updatedRecords.push({
                    user_id: record.user_id,
                    encrypted_token: encryptedToken,
                    encryption_iv: iv,
                    encryption_salt: salt,
                });
            } catch (err: any) {
                logger.error(`Failed to rotate secret for user ${record.user_id}: ${err.message}`);
            }
        }

        if (updatedRecords.length > 0) {
            const { error: updateError } = await supabase
                .from("abha_links")
                .upsert(updatedRecords, { onConflict: "user_id" });

            if (updateError) {
                logger.error(`Error updating records: ${updateError.message}`);
                process.exit(1);
            }

            totalUpdated += updatedRecords.length;
            logger.info(`Rotated secrets for ${updatedRecords.length} records in this batch.`);
        }

        offset += limit;
    }

    logger.info(`ABHA secret rotation completed successfully. Total updated: ${totalUpdated}`);
    process.exit(0);
}

main().catch((err) => {
    logger.error(`Unhandled error during secret rotation: ${err.message}`);
    process.exit(1);
});
