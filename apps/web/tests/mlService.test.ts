import { getMlServiceUrl, validateMlServiceUrl } from "@/lib/mlService";

describe("mlService URL validation", () => {
    const originalMlServiceUrl = process.env.ML_SERVICE_URL;

    afterEach(() => {
        process.env.ML_SERVICE_URL = originalMlServiceUrl;
    });

    it("accepts http and https public service URLs", () => {
        expect(validateMlServiceUrl("https://ml-service.example.com")).toEqual({ valid: true });
        expect(validateMlServiceUrl("http://ml-service.example.com:8000")).toEqual({
            valid: true,
        });
    });

    it.each([
        "not-a-url",
        "file:///tmp/ml.sock",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://10.0.0.4:8000",
        "http://172.16.0.4:8000",
        "http://172.31.255.255:8000",
        "http://192.168.1.20:8000",
        "http://169.254.169.254",
        "http://[::1]:8000",
        "http://[fc00::1]:8000",
        "http://[fe80::1]:8000",
    ])("rejects unsafe ML_SERVICE_URL %s", (url) => {
        expect(validateMlServiceUrl(url).valid).toBe(false);
    });

    it("normalizes trailing slashes and returns null for unsafe values", () => {
        process.env.ML_SERVICE_URL = " https://ml-service.example.com/// ";
        expect(getMlServiceUrl()).toBe("https://ml-service.example.com");

        process.env.ML_SERVICE_URL = "http://127.0.0.1:8000";
        expect(getMlServiceUrl()).toBeNull();
    });
});
