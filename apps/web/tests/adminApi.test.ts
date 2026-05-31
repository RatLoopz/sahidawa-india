import { buildAdminApiBase } from "@/lib/adminApi";

describe("buildAdminApiBase", () => {
    const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

    beforeEach(() => {
        delete process.env.NEXT_PUBLIC_API_URL;
    });

    afterAll(() => {
        process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    });

    it("uses the local API origin when no API URL is configured", () => {
        expect(buildAdminApiBase()).toBe("http://localhost:4000/api/v1/admin");
    });

    it("uses NEXT_PUBLIC_API_URL when no argument is passed", () => {
        process.env.NEXT_PUBLIC_API_URL = "https://api.sahidawa.example";

        expect(buildAdminApiBase()).toBe("https://api.sahidawa.example/api/v1/admin");
    });

    it("uses the local API origin when the configured API URL is blank", () => {
        expect(buildAdminApiBase("   ")).toBe("http://localhost:4000/api/v1/admin");
    });

    it("appends the admin API path to a bare configured API origin", () => {
        expect(buildAdminApiBase("http://localhost:4000")).toBe(
            "http://localhost:4000/api/v1/admin"
        );
    });

    it("normalizes trailing slashes before appending the admin API path", () => {
        expect(buildAdminApiBase("https://api.sahidawa.example///")).toBe(
            "https://api.sahidawa.example/api/v1/admin"
        );
    });

    it("does not duplicate the admin API path if it is already configured", () => {
        expect(buildAdminApiBase("http://localhost:4000/api/v1/admin")).toBe(
            "http://localhost:4000/api/v1/admin"
        );
    });

    it("does not duplicate the admin API path if it is already configured with a trailing slash", () => {
        expect(buildAdminApiBase("http://localhost:4000/api/v1/admin/")).toBe(
            "http://localhost:4000/api/v1/admin"
        );
    });
});
