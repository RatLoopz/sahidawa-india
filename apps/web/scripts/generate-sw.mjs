#!/usr/bin/env node

/**
 * generate-sw.mjs
 *
 * Replaces the CACHE_VERSION value in `public/sw.js` in-place with a
 * build-specific identifier (Git short SHA, falling back to a timestamp).
 *
 * Runs automatically via the `prebuild` / `predev` npm lifecycle hooks
 * so every build produces a service worker with a fresh cache version.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const swPath = resolve(__dirname, "..", "public", "sw.js");

// ---------------------------------------------------------------------------
// Determine a unique build hash (same logic as next.config.mjs)
// ---------------------------------------------------------------------------
function getBuildHash() {
    try {
        const sha = execSync("git rev-parse --short HEAD", {
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "ignore"],
        }).trim();
        if (sha) return sha;
    } catch {
        // Not a git repo or git not available
    }
    return Date.now().toString(36);
}

const buildHash = getBuildHash();

// ---------------------------------------------------------------------------
// In-place replacement of CACHE_VERSION in sw.js
// ---------------------------------------------------------------------------
const content = readFileSync(swPath, "utf-8");
const pattern = /const CACHE_VERSION = ".*?";/;

if (!pattern.test(content)) {
    console.warn("[generate-sw] ⚠  Could not find CACHE_VERSION in sw.js — skipping.");
    process.exit(0);
}

const updated = content.replace(
    pattern,
    `const CACHE_VERSION = "${buildHash}";`
);

if (content === updated) {
    console.log(`[generate-sw] ✔  sw.js CACHE_VERSION already up to date ("${buildHash}")`);
    process.exit(0);
}

writeFileSync(swPath, updated, "utf-8");
console.log(`[generate-sw] ✔  sw.js CACHE_VERSION = "${buildHash}"`);
