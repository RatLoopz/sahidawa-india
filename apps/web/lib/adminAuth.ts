import type { Session, User } from "@supabase/supabase-js";

export type AdminRole = "admin" | "moderator";

function toAdminRole(value: unknown): AdminRole | null {
    if (value === "admin" || value === "moderator") {
        return value;
    }

    return null;
}

export function getAdminRoleFromUser(
    user: Pick<User, "app_metadata" | "user_metadata"> | null | undefined
): AdminRole | null {
    return toAdminRole(user?.app_metadata?.role) ?? toAdminRole(user?.user_metadata?.role);
}

export function getAdminRoleFromSession(
    session: Pick<Session, "user"> | null | undefined
): AdminRole | null {
    return getAdminRoleFromUser(session?.user);
}

export function canMutateAdminData(role: AdminRole | null | undefined): boolean {
    return role === "admin";
}
