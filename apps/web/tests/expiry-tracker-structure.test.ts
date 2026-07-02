/** @jest-environment node */

import fs from "node:fs";
import path from "node:path";

const expiryTrackerDir = path.join(process.cwd(), "app", "[locale]", "expiry-tracker");
const pagePath = path.join(expiryTrackerDir, "page.tsx");
const componentsDir = path.join(expiryTrackerDir, "components");

describe("ExpiryTrackerPage component structure", () => {
    it("imports extracted form, summary, table, and modal components", () => {
        const pageSource = fs.readFileSync(pagePath, "utf8");

        expect(pageSource).toContain('from "./components/ExpiryForm"');
        expect(pageSource).toContain('from "./components/ExpirySummary"');
        expect(pageSource).toContain('from "./components/ExpiryTable"');
        expect(pageSource).toContain('from "./components/ExpiryModal"');
    });

    it.each(["ExpiryForm.tsx", "ExpirySummary.tsx", "ExpiryTable.tsx", "ExpiryModal.tsx"])(
        "keeps %s in the local expiry tracker components directory",
        (fileName) => {
            expect(fs.existsSync(path.join(componentsDir, fileName))).toBe(true);
        }
    );
});
