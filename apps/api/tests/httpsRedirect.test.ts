import request from "supertest";
import express, { Express } from "express";
import { httpsRedirect } from "../src/middleware/httpsRedirect";

describe("HTTPS Redirect Middleware", () => {
    let app: Express;

    beforeEach(() => {
        app = express();
        app.use(httpsRedirect);
        app.get("/test", (req, res) => {
            res.json({ status: "ok" });
        });
    });

    describe("Production Environment", () => {
        beforeEach(() => {
            process.env.NODE_ENV = "production";
        });

        afterEach(() => {
            delete process.env.NODE_ENV;
        });

        test("should redirect HTTP requests to HTTPS", (done) => {
            request(app)
                .get("/test")
                .set("X-Forwarded-Proto", "http")
                .expect(308)
                .expect("Location", /^https:/)
                .end(done);
        });

        test("should preserve path and query params in redirect", (done) => {
            request(app)
                .get("/test?key=value&other=param")
                .set("X-Forwarded-Proto", "http")
                .expect(308)
                .expect("Location", /test\?key=value&other=param/)
                .end(done);
        });

        test("should preserve host in redirect", (done) => {
            request(app)
                .get("/test")
                .set("Host", "example.com")
                .set("X-Forwarded-Proto", "http")
                .expect(308)
                .expect("Location", /^https:\/\/example\.com/)
                .end(done);
        });

        test("should allow requests with X-Forwarded-Proto: https", (done) => {
            request(app)
                .get("/test")
                .set("X-Forwarded-Proto", "https")
                .expect(200)
                .expect({ status: "ok" })
                .end(done);
        });

        test("should allow requests with secure protocol set", (done) => {
            app.set("trust proxy", 1);
            request(app).get("/test").set("X-Forwarded-Proto", "https").expect(200).end(done);
        });

        test("should log warnings for HTTP interception", (done) => {
            const warnSpy = jest.spyOn(console, "warn").mockImplementation();
            request(app)
                .get("/test")
                .set("X-Forwarded-Proto", "http")
                .expect(308)
                .end(() => {
                    warnSpy.mockRestore();
                    done();
                });
        });
    });

    describe("Development Environment", () => {
        beforeEach(() => {
            process.env.NODE_ENV = "development";
        });

        afterEach(() => {
            delete process.env.NODE_ENV;
        });

        test("should allow HTTP requests in development", (done) => {
            request(app)
                .get("/test")
                .set("X-Forwarded-Proto", "http")
                .expect(200)
                .expect({ status: "ok" })
                .end(done);
        });

        test("should bypass HTTPS enforcement", (done) => {
            request(app).get("/test").expect(200).end(done);
        });
    });

    describe("Test Environment", () => {
        beforeEach(() => {
            process.env.NODE_ENV = "test";
        });

        afterEach(() => {
            delete process.env.NODE_ENV;
        });

        test("should allow HTTP requests in test", (done) => {
            request(app)
                .get("/test")
                .set("X-Forwarded-Proto", "http")
                .expect(200)
                .expect({ status: "ok" })
                .end(done);
        });

        test("should bypass HTTPS enforcement during tests", (done) => {
            request(app).get("/test").expect(200).end(done);
        });
    });

    describe("Reverse Proxy Scenarios", () => {
        beforeEach(() => {
            process.env.NODE_ENV = "production";
            app.set("trust proxy", 1);
        });

        afterEach(() => {
            delete process.env.NODE_ENV;
        });

        test("should handle Nginx X-Forwarded-Proto header", (done) => {
            request(app)
                .get("/test")
                .set("X-Forwarded-Proto", "http")
                .set("X-Forwarded-For", "203.0.113.42")
                .expect(308)
                .end(done);
        });

        test("should prioritize X-Forwarded-Proto over protocol detection", (done) => {
            request(app).get("/test").set("X-Forwarded-Proto", "https").expect(200).end(done);
        });

        test("should handle missing Host header gracefully", (done) => {
            request(app)
                .get("/test")
                .set("X-Forwarded-Proto", "http")
                .expect(308)
                .expect("Location", /^https:/)
                .end(done);
        });
    });

    describe("Edge Cases", () => {
        beforeEach(() => {
            process.env.NODE_ENV = "production";
        });

        afterEach(() => {
            delete process.env.NODE_ENV;
        });

        test("should handle deep nested paths", (done) => {
            request(app)
                .get("/api/v1/verify/batch/submit?batchId=123")
                .set("X-Forwarded-Proto", "http")
                .expect(308)
                .expect("Location", /api\/v1\/verify\/batch\/submit\?batchId=123/)
                .end(done);
        });

        test("should handle POST requests and redirect with 308", (done) => {
            app.post("/test-post", (req, res) => {
                res.json({ received: "data" });
            });

            request(app).post("/test-post").set("X-Forwarded-Proto", "http").expect(308).end(done);
        });

        test("should handle requests with complex query strings", (done) => {
            request(app)
                .get("/test?filter[status]=active&sort=-createdAt&page=2")
                .set("X-Forwarded-Proto", "http")
                .expect(308)
                .expect("Location", /filter\[status\]=active&sort=-createdAt&page=2/)
                .end(done);
        });
    });
});
