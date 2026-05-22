import { execSync } from "child_process";

// 1. Define target type labels, colors, and descriptions
const TARGET_LABELS = {
    "type:bug": { color: "d73a4a", description: "Something isn't working" },
    "type:feature": { color: "0e8a16", description: "New feature or request" },
    "type:docs": { color: "0075ca", description: "Improvements or additions to documentation" },
    "type:testing": { color: "f4d03f", description: "Unit tests, integration tests" },
    "type:security": { color: "b60205", description: "Auth, rate limiting, security" },
    "type:performance": { color: "8e44ad", description: "Performance optimization or latency improvements" },
    "type:design": { color: "e91e63", description: "UI styling, design layout, animations" },
    "type:refactor": { color: "3f51b5", description: "Code structure cleanup without behavior change" },
    "type:devops": { color: "f9d0c4", description: "CI/CD, Docker, deployment" },
    "type:accessibility": { color: "008080", description: "Accessibility improvements (ARIA, WCAG)" }
};

// Map old/duplicate label names to new type: labels
const DUPLICATE_MAPPING = {
    "bug": "type:bug",
    "documentation": "type:docs",
    "docs": "type:docs",
    "enhancement": "type:feature",
    "feature": "type:feature",
    "testing": "type:testing",
    "security": "type:security",
    "performance": "type:performance",
    "design": "type:design",
    "refactor": "type:refactor",
    "devops": "type:devops",
    "ci-cd": "type:devops",
    "docker": "type:devops",
    "accessibility": "type:accessibility"
};

function runCmd(cmd) {
    try {
        return execSync(cmd, { encoding: "utf8" }).trim();
    } catch (error) {
        console.error(`Command failed: ${cmd}\nError: ${error.message}`);
        return null;
    }
}

async function main() {
    console.log("🚀 Starting Repository Label Management...");

    // 2. Fetch existing labels
    console.log("📋 Fetching existing labels...");
    const existingLabelsRaw = runCmd("gh label list --json name");
    if (!existingLabelsRaw) {
        console.error("❌ Failed to list labels. Make sure you are authenticated with GitHub CLI (gh auth status).");
        process.exit(1);
    }

    const existingLabels = JSON.parse(existingLabelsRaw).map(l => l.name);
    console.log(`Found ${existingLabels.length} existing labels in repo.`);

    // 3. Create target type:* labels if they don't exist
    for (const [name, info] of Object.entries(TARGET_LABELS)) {
        if (existingLabels.includes(name)) {
            console.log(`✅ Label "${name}" already exists. Updating details...`);
            runCmd(`gh label edit "${name}" --color "${info.color}" --description "${info.description}"`);
        } else {
            console.log(`➕ Creating label "${name}"...`);
            runCmd(`gh label create "${name}" --color "${info.color}" --description "${info.description}"`);
        }
    }

    // 4. Fetch closed Pull Requests
    console.log("🔍 Fetching closed Pull Requests...");
    const closedPrsRaw = runCmd("gh pr list --state closed --limit 100 --json number,title,labels");
    if (!closedPrsRaw) {
        console.error("❌ Failed to list closed Pull Requests.");
        process.exit(1);
    }

    const closedPrs = JSON.parse(closedPrsRaw);
    console.log(`Found ${closedPrs.length} closed Pull Requests to audit and label.`);

    // 5. Audit each closed PR and assign applicable type:* labels
    for (const pr of closedPrs) {
        const applicableLabels = new Set();

        // Check current labels to map duplicates
        const currentLabelNames = pr.labels.map(l => l.name);
        for (const labelName of currentLabelNames) {
            if (DUPLICATE_MAPPING[labelName]) {
                applicableLabels.add(DUPLICATE_MAPPING[labelName]);
            }
        }

        // Apply rules based on PR title
        const title = pr.title.toLowerCase();
        if (/fix|bug|issue|crash|error|broken/i.test(title)) {
            applicableLabels.add("type:bug");
        }
        if (/feat|feature|implement|add/i.test(title)) {
            applicableLabels.add("type:feature");
        }
        if (/docs|documentation|readme|setupguide/i.test(title)) {
            applicableLabels.add("type:docs");
        }
        if (/test|testing|spec|coverage/i.test(title)) {
            applicableLabels.add("type:testing");
        }
        if (/security|auth|rate limit|cors|helmet|xss/i.test(title)) {
            applicableLabels.add("type:security");
        }
        if (/perf|performance|latency|speed|optimize|cache/i.test(title)) {
            applicableLabels.add("type:performance");
        }
        if (/design|css|layout|style|ui|ux|theme|animation|badge|card|font|tailwind/i.test(title)) {
            applicableLabels.add("type:design");
        }
        if (/refactor|cleanup|rename|restructure/i.test(title)) {
            applicableLabels.add("type:refactor");
        }
        if (/devops|ci|cd|workflow|docker|compose|deploy|husky/i.test(title)) {
            applicableLabels.add("type:devops");
        }
        if (/aria|accessibility|a11y|wcag|screen reader/i.test(title)) {
            applicableLabels.add("type:accessibility");
        }

        // If any applicable labels found, assign them to the closed PR
        if (applicableLabels.size > 0) {
            const labelsToAdd = Array.from(applicableLabels);
            console.log(`🏷️ Labeling PR #${pr.number} ("${pr.title}") with: ${labelsToAdd.join(", ")}`);
            const labelArgs = labelsToAdd.map(l => `"${l}"`).join(",");
            runCmd(`gh pr edit ${pr.number} --add-label ${labelArgs}`);
        }
    }

    // 6. Remove duplicate labels without "type:" prefix
    console.log("🧹 Removing duplicate labels without 'type:' prefix...");
    const duplicateLabelsToRemove = Object.keys(DUPLICATE_MAPPING).filter(l => l !== "feature"); // avoid deleting custom user definitions unless they match mapping
    
    // We fetch again to see which of the old duplicate labels still remain
    const updatedLabelsRaw = runCmd("gh label list --json name");
    if (updatedLabelsRaw) {
        const currentLabels = JSON.parse(updatedLabelsRaw).map(l => l.name);
        for (const oldLabel of duplicateLabelsToRemove) {
            if (currentLabels.includes(oldLabel)) {
                console.log(`🔥 Deleting duplicate label: "${oldLabel}"`);
                runCmd(`gh label delete "${oldLabel}" --yes`);
            }
        }
    }

    console.log("✨ Repository Label Management Completed Successfully!");
}

main().catch(console.error);
