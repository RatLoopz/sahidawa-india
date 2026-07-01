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
                ...input.metadata,
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
        await supabase
            .from("user_scan_history")
            .update({
                ...input.metadata,
                device_id: input.deviceId,
                client_updated_at: new Date(Number(input.clientUpdatedAt)).toISOString(),
            })
            .eq("id", existing.id);

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
