process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "dummy-anon-key";
process.env.ML_SERVICE_URL = "http://localhost:8000";
process.env.NEXT_PUBLIC_ML_SERVICE_URL = "http://localhost:8000";
process.env.NEXT_PUBLIC_API_URL = "http://localhost:4000";
process.env.NODE_ENV = "test";

if (typeof global.Request === "undefined" && typeof Request !== "undefined") {
    global.Request = Request;
    global.Response = Response;
    global.fetch = fetch;
    global.Headers = Headers;
}

if (typeof global.WebSocket === "undefined") {
    global.WebSocket = class WebSocket {};
}
