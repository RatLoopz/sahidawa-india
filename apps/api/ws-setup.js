"use strict";
/**
 * WebSocket polyfill for Node.js < 22.
 *
 * @supabase/realtime-js v2 requires a native `WebSocket` global.
 * Node.js < 22 does not ship one, so we shim it with the `ws` package here,
 * before any TypeScript module (including supabase-js) is loaded.
 *
 * This file is loaded via `ts-node-dev -r ./ws-setup.js` so it runs first,
 * before the TS compiler imports are hoisted.
 */
if (typeof globalThis.WebSocket === "undefined") {
    globalThis.WebSocket = require("ws");
}

// Pre-load environment variables before ES6 imports are loaded and hoisted
const path = require("path");
const fs = require("fs");

const rootEnv = path.resolve(__dirname, "../../.env");
if (fs.existsSync(rootEnv)) {
    require("dotenv").config({ path: rootEnv });
}
const localEnv = path.resolve(__dirname, ".env");
if (fs.existsSync(localEnv)) {
    require("dotenv").config({ path: localEnv });
}
// Fallback to current working directory .env
require("dotenv").config();
