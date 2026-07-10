import { supabase } from "../db/client";

/**
 * Thrown when clientUpdatedAt is missing, non-numeric, or otherwise cannot be
 * parsed into a valid timestamp. Route handlers should catch this and return
 * 400, rather than letting resolveConflict silently treat the write as stale.
 */
export class InvalidClientTimestampError extends Error {
    public readonly code: string;

    constructor(
        message = "clientUpdatedAt must be a valid numeric timestamp string (milliseconds since epoch)"
    ) {
        super(message);
        this.name = "InvalidClientTimestampError";
        this.code = "errors.invalidClientTimestamp";
    }
}

/**
 * Parses a client-supplied timestamp string into epoch milliseconds.
 * Throws InvalidClientTimestampError for missing, empty, or non-numeric
 * values instead of letting `new Date(NaN)` silently make every downstream
 * "is this newer" comparison evaluate to false.
 */
function parseClientUpdatedAt(raw: string): number {
    const ms = Number(raw);
    if (!raw || !Number.isFinite(ms)) {
        throw new InvalidClientTimestampError();
    }
    return ms;
}

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
    const clientUpdatedAtMs = parseClientUpdatedAt(input.clientUpdatedAt);

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
                client_updated_at: new Date(clientUpdatedAtMs).toISOString(),
            })
            .select("id")
            .single();

        if (error) {
            throw error;
        }
        return data!.id;
    }

    const incomingIsNewer =
        new Date(clientUpdatedAtMs) > new Date(existing.client_updated_at || 0);

    if (incomingIsNewer) {
        const { error: updateError } = await supabase
            .from("user_scan_history")
            .update({
                ...safeMetadata,
                device_id: input.deviceId,
                client_updated_at: new Date(clientUpdatedAtMs).toISOString(),
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