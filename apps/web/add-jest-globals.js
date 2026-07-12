import fs from "fs";
import path from "path";

const testsDir = path.join(process.cwd(), "apps/web/tests");

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== "node_modules") {
                processDirectory(fullPath);
            }
        } else if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
            processFile(fullPath);
        }
    }
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, "utf-8");
    if (content.includes("jest.") && !content.includes("@jest/globals")) {
        const importStmt = `import { describe, it, expect, jest, beforeEach, afterEach, beforeAll, afterAll } from "@jest/globals";\n`;

        // Find the right place to insert. E.g., after `/** @jest-environment jsdom */`
        let insertIndex = 0;
        if (content.startsWith("/** @jest-environment jsdom */")) {
            insertIndex = content.indexOf("*/") + 2;
            // skip newlines
            while (content[insertIndex] === "\n" || content[insertIndex] === "\r") {
                insertIndex++;
            }
        }

        content = content.slice(0, insertIndex) + importStmt + content.slice(insertIndex);
        fs.writeFileSync(filePath, content, "utf-8");
        console.log("Added globals to:", filePath);
    }
}

processDirectory(testsDir);
