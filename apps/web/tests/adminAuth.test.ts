import {
    getAdminRoleFromUser,
    getAdminRoleFromSession,
    canMutateAdminData,
} from "../lib/adminAuth";

describe("getAdminRoleFromUser", () => {
    it("returns null when only user_metadata.role is set to admin (self-escalation attempt)", () => {
        const role = getAdminRoleFromUser({
            app_metadata: {},
            user_metadata: { role: "admin" },
        });

        expect(role).toBeNull();
    });

    it("returns null when only user_metadata.role is set to moderator (self-escalation attempt)", () => {
        const role = getAdminRoleFromUser({
            app_metadata: {},
            user_metadata: { role: "moderator" },
        });

        expect(role).toBeNull();
    });

    it("returns 'admin' when app_metadata.role is admin, regardless of user_metadata", () => {
        const role = getAdminRoleFromUser({
            app_metadata: { role: "admin" },
            user_metadata: { role: "user" },
        });

        expect(role).toBe("admin");
    });

    it("returns 'moderator' when app_metadata.role is moderator", () => {
        const role = getAdminRoleFromUser({
            app_metadata: { role: "moderator" },
            user_metadata: {},
        });

        expect(role).toBe("moderator");
    });

    it("returns null when neither app_metadata nor user_metadata has a role", () => {
        const role = getAdminRoleFromUser({ app_metadata: {}, user_metadata: {} });

        expect(role).toBeNull();
    });

    it("returns null when user is null or undefined", () => {
        expect(getAdminRoleFromUser(null)).toBeNull();
        expect(getAdminRoleFromUser(undefined)).toBeNull();
    });
});

describe("getAdminRoleFromSession", () => {
    it("returns null for a self-escalated session (user_metadata only)", () => {
        const role = getAdminRoleFromSession({
            user: { app_metadata: {}, user_metadata: { role: "admin" } },
        });

        expect(role).toBeNull();
    });

    it("returns 'admin' for a legitimately admin session", () => {
        const role = getAdminRoleFromSession({
            user: { app_metadata: { role: "admin" }, user_metadata: {} },
        });

        expect(role).toBe("admin");
    });

    it("returns null when session is null", () => {
        expect(getAdminRoleFromSession(null)).toBeNull();
    });
});

describe("canMutateAdminData", () => {
    it("returns false for a self-escalated role since it was never resolved past null", () => {
        const selfEscalatedRole = getAdminRoleFromUser({
            app_metadata: {},
            user_metadata: { role: "admin" },
        });

        expect(canMutateAdminData(selfEscalatedRole)).toBe(false);
    });

    it("returns true only for admin", () => {
        expect(canMutateAdminData("admin")).toBe(true);
        expect(canMutateAdminData("moderator")).toBe(false);
        expect(canMutateAdminData(null)).toBe(false);
        expect(canMutateAdminData(undefined)).toBe(false);
    });
});
