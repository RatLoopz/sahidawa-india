/* eslint-disable @typescript-eslint/no-require-imports */

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "dummy-anon-key";
process.env.ML_SERVICE_URL = "http://localhost:8000";
process.env.NEXT_PUBLIC_ML_SERVICE_URL = "http://localhost:8000";
process.env.NEXT_PUBLIC_API_URL = "http://localhost:4000";
process.env.NODE_ENV = "test";

const { TextDecoder, TextEncoder } = require("util");
const { ReadableStream } = require("stream/web");
const { MessageChannel, MessagePort } = require("worker_threads");
if (typeof global.TextDecoder === "undefined") {
    global.TextDecoder = TextDecoder;
}
if (typeof global.TextEncoder === "undefined") {
    global.TextEncoder = TextEncoder;
}
if (typeof global.ReadableStream === "undefined") {
    global.ReadableStream = ReadableStream;
}
if (typeof global.MessagePort === "undefined") {
    global.MessagePort = MessagePort;
}
if (typeof global.MessageChannel === "undefined") {
    global.MessageChannel = MessageChannel;
}

const undici = require("undici");

if (typeof global.Request === "undefined") {
    if (typeof Request !== "undefined") {
        global.Request = Request;
    } else {
        global.Request = undici.Request;
    }
}

if (typeof global.Response === "undefined") {
    if (typeof Response !== "undefined") {
        global.Response = Response;
    } else {
        global.Response = undici.Response;
    }
}

if (typeof global.Headers === "undefined") {
    if (typeof Headers !== "undefined") {
        global.Headers = Headers;
    } else {
        global.Headers = undici.Headers;
    }
}

if (typeof global.fetch === "undefined") {
    if (typeof fetch !== "undefined") {
        global.fetch = fetch;
    } else {
        global.fetch = undici.fetch;
    }
}

if (typeof global.WebSocket === "undefined") {
    global.WebSocket = class WebSocket {};
}
