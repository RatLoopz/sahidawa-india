#!/usr/bin/env node

/**
 * CI check: verify all locale JSON files contain every key present in en.json.
 *
 * Recursively extracts all dot-path keys from en.json and checks that each
 * locale file defines them too. Reports missing keys per locale and exits
 * with code 1 if any are found.
 *
 * Usage: node apps/web/scripts/check-locale-keys.mjs
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const MESSAGES_DIR = resolve(import.meta.dirname, "..", "messages");
const EN_FILE = join(MESSAGES_DIR, "en.json");

/**
 * Recursively collect all leaf-key dot-paths from a JSON object.
 * e.g. { a: { b: "x" }, c: "y" } → ["a.b", "c"]
 */
function collectKeys(obj, prefix = "") {
    const keys = [];
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            keys.push(...collectKeys(value, fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

/** Check whether a dot-path key exists in an object. */
function hasKey(obj, dotPath) {
    const parts = dotPath.split(".");
    let current = obj;
    for (const part of parts) {
        if (typeof current !== "object" || current === null || !(part in current)) {
            return false;
        }
        current = current[part];
    }
    return true;
}

// --- Main ---

const enData = JSON.parse(readFileSync(EN_FILE, "utf8"));
const enKeys = collectKeys(enData);

console.log(`📋 en.json has ${enKeys.length} leaf keys.\n`);

const localeFiles = readdirSync(MESSAGES_DIR).filter(
    (f) => f.endsWith(".json") && f !== "en.json"
);

let totalMissing = 0;

for (const file of localeFiles) {
    const filePath = join(MESSAGES_DIR, file);
    const localeData = JSON.parse(readFileSync(filePath, "utf8"));
    const locale = file.replace(".json", "");

    const missing = enKeys.filter((key) => !hasKey(localeData, key));

    if (missing.length > 0) {
        totalMissing += missing.length;
        console.log(`❌ ${locale}: ${missing.length} missing key(s)`);
        for (const key of missing) {
            console.log(`   - ${key}`);
        }
    } else {
        console.log(`✅ ${locale}: all keys present`);
    }
}

console.log(
    `\n${totalMissing === 0 ? "✅ All locales have complete key coverage." : `❌ ${totalMissing} total missing key(s) found across locale files.`}`
);

process.exit(totalMissing === 0 ? 0 : 1);
