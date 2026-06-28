/** @jest-environment node */

import fs from "node:fs";
import path from "node:path";

const historyPagePath = path.join(process.cwd(), "app", "[locale]", "history", "page.tsx");

describe("HistoryPage export modal loading", () => {
    it("lazy loads ExportModal instead of importing it in the initial bundle", () => {
        const pageSource = fs.readFileSync(historyPagePath, "utf8");

        expect(pageSource).toContain('import dynamic from "next/dynamic"');
        expect(pageSource).not.toContain('import ExportModal from "./ExportModal"');
        expect(pageSource).toContain('dynamic(() => import("./ExportModal")');
    });
});
