#!/usr/bin/env node

/**
 * Propagate new vaccineHub i18n keys from en.json to all other locale files.
 *
 * For each locale file, this script deep-merges the vaccineHub keys from en.json
 * into the locale file WITHOUT overwriting any existing translated values.
 * Only missing keys are added (using English values as placeholders).
 *
 * Usage: node apps/web/scripts/propagate-vaccine-hub-keys.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const MESSAGES_DIR = resolve(import.meta.dirname, "..", "messages");
const EN_FILE = join(MESSAGES_DIR, "en.json");

/** Deep-merge source into target, only adding keys that don't exist in target. */
function deepMerge(target, source) {
    const result = { ...target };
    for (const [key, value] of Object.entries(source)) {
        if (!(key in result)) {
            // Key is missing — add the English fallback
            result[key] = value;
        } else if (
            typeof value === "object" &&
            value !== null &&
            !Array.isArray(value) &&
            typeof result[key] === "object" &&
            result[key] !== null &&
            !Array.isArray(result[key])
        ) {
            // Both are objects — recurse
            result[key] = deepMerge(result[key], value);
        }
        // Otherwise the locale already has a value for this key — keep it
    }
    return result;
}

// Read en.json
const enData = JSON.parse(readFileSync(EN_FILE, "utf8"));
const enVaccineHub = enData.vaccineHub;

if (!enVaccineHub) {
    console.error("ERROR: vaccineHub key not found in en.json");
    process.exit(1);
}

const localeFiles = readdirSync(MESSAGES_DIR).filter(
    (f) => f.endsWith(".json") && f !== "en.json"
);

let totalKeysAdded = 0;

for (const file of localeFiles) {
    const filePath = join(MESSAGES_DIR, file);
    const localeData = JSON.parse(readFileSync(filePath, "utf8"));
    const locale = file.replace(".json", "");

    const existingVaccineHub = localeData.vaccineHub || {};
    const mergedVaccineHub = deepMerge(existingVaccineHub, enVaccineHub);

    // Count how many keys were added
    const beforeKeys = JSON.stringify(existingVaccineHub).length;
    const afterKeys = JSON.stringify(mergedVaccineHub).length;
    const keysAdded = afterKeys > beforeKeys;

    localeData.vaccineHub = mergedVaccineHub;

    writeFileSync(filePath, JSON.stringify(localeData, null, 4) + "\n", "utf8");

    if (keysAdded) {
        totalKeysAdded++;
        console.log(`✅ ${locale}: new keys added (English placeholders)`);
    } else {
        console.log(`⏭️  ${locale}: all keys already present`);
    }
}

console.log(`\nDone. Updated ${totalKeysAdded}/${localeFiles.length} locale files.`);
