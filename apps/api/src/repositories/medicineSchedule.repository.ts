import { supabase } from "../db/client";

/**
 * Data-access layer for medicine schedules and dose logs.
 *
 * Every method is a thin, single-purpose wrapper around one Supabase query and
 * returns the raw `{ data, error }` result unchanged. Error interpretation and
 * the HTTP-status mapping live in the service layer, which needs the distinct
 * per-operation error messages the original route handlers used — so, unlike a
 * throw-on-error repository, these methods pass the result through untouched.
 */
export const medicineScheduleRepository = {
    findAllByUser(userId: string) {
        return supabase
            .from("medicine_schedules")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
    },

    findByIdForUser(id: string, userId: string) {
        return supabase
            .from("medicine_schedules")
            .select("*")
            .eq("id", id)
            .eq("user_id", userId)
            .maybeSingle();
    },

    findDatesAndTiming(id: string, userId: string) {
        return supabase
            .from("medicine_schedules")
            .select("start_date, end_date, frequency, times")
            .eq("id", id)
            .eq("user_id", userId)
            .maybeSingle();
    },

    findIdForUser(id: string, userId: string) {
        return supabase
            .from("medicine_schedules")
            .select("id")
            .eq("id", id)
            .eq("user_id", userId)
            .maybeSingle();
    },

    insertSchedule(payload: Record<string, unknown>) {
        return supabase.from("medicine_schedules").insert(payload).select().single();
    },

    updateSchedule(id: string, userId: string, updateData: Record<string, unknown>) {
        return supabase
            .from("medicine_schedules")
            .update(updateData)
            .eq("id", id)
            .eq("user_id", userId)
            .select()
            .single();
    },

    deleteSchedule(id: string, userId: string) {
        return supabase
            .from("medicine_schedules")
            .delete()
            .eq("id", id)
            .eq("user_id", userId)
            .select("id");
    },

    upsertDoseLog(payload: Record<string, unknown>) {
        return supabase
            .from("dose_logs")
            .upsert(payload, {
                onConflict: "schedule_id, log_date, log_time",
                ignoreDuplicates: false,
            })
            .select()
            .single();
    },

    findDoseLogsBySchedule(id: string, userId: string) {
        return supabase
            .from("dose_logs")
            .select("*")
            .eq("schedule_id", id)
            .eq("user_id", userId)
            .order("log_date", { ascending: false })
            .order("log_time", { ascending: false });
    },

    findDoseLogsPage(
        id: string,
        userId: string,
        fromDate: string,
        toDate: string,
        offset: number,
        pageSize: number
    ) {
        return supabase
            .from("dose_logs")
            .select("*")
            .eq("schedule_id", id)
            .eq("user_id", userId)
            .gte("log_date", fromDate)
            .lte("log_date", toDate)
            .order("id", { ascending: true })
            .range(offset, offset + pageSize - 1);
    },

    findActiveSchedulesForDate(userId: string, date: string) {
        return supabase
            .from("medicine_schedules")
            .select("*")
            .eq("user_id", userId)
            .eq("is_active", true)
            .lte("start_date", date)
            .or(`end_date.is.null,end_date.gte.${date}`);
    },

    findDoseLogsForSchedulesOnDate(scheduleIds: string[], userId: string, date: string) {
        return supabase
            .from("dose_logs")
            .select("*")
            .in("schedule_id", scheduleIds)
            .eq("user_id", userId)
            .eq("log_date", date);
    },
};
