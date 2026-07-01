import { supabase } from "../db/client";

/**
 * Last-write-wins by client_updated_at, with the losing write preserved in
 * scan_conflict_log for auditability instead of being silently discarded.
 */
export async function resolveConflict(input: {
    scanId: string; // The client-generated or server-generated ID for the user_scan_history row
    metadata: any;
    deviceId: string;
    clientUpdatedAt: string;
    userId: string;
}) {
    const safeMetadata = {
        medicine_name: input.metadata?.medicine_name,
        timestamp: input.metadata?.timestamp,
        scanned_at: input.metadata?.scanned_at,
        query: input.metadata?.query,
        source: input.metadata?.source,
        status: input.metadata?.status,
        brand_name: input.metadata?.brand_name,
        generic_name: input.metadata?.generic_name,
        manufacturer: input.metadata?.manufacturer,
        batch_number: input.metadata?.batch_number,
        expiry_date: input.metadata?.expiry_date,
        cdsco_approval_status: input.metadata?.cdsco_approval_status,
        is_counterfeit_alert: input.metadata?.is_counterfeit_alert,
    };

    const existing = input.scanId
        ? (
              await supabase
                  .from("user_scan_history")
                  .select("*")
                  .eq("id", input.scanId)
                  .maybeSingle()
          ).data
        : null;

    if (!existing) {
        const { data, error } = await supabase
            .from("user_scan_history")
            .insert({
                ...safeMetadata,
                id: input.scanId,
                user_id: input.userId,
                device_id: input.deviceId,
                client_updated_at: new Date(Number(input.clientUpdatedAt)).toISOString(),
            })
            .select("id")
            .single();

        if (error) {
            throw error;
        }
        return data!.id;
    }

    const incomingIsNewer =
        new Date(Number(input.clientUpdatedAt)) > new Date(existing.client_updated_at || 0);

    if (incomingIsNewer) {
        const { error: updateError } = await supabase
            .from("user_scan_history")
            .update({
                ...safeMetadata,
                device_id: input.deviceId,
                client_updated_at: new Date(Number(input.clientUpdatedAt)).toISOString(),
            })
            .eq("id", input.scanId);

        await supabase.from("scan_conflict_log").insert({
            scan_id: existing.id,
            device_id: input.deviceId,
            attempted_payload: input.metadata,
            resolution: "applied",
        });
    } else {
        await supabase.from("scan_conflict_log").insert({
            scan_id: existing.id,
            device_id: input.deviceId,
            attempted_payload: input.metadata,
            resolution: "rejected_stale",
        });
    }

    return existing.id;
}
