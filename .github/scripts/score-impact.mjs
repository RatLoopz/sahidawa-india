#!/usr/bin/env node
/**
 * SahiDawa DevTrack — Impact Scoring Engine
 *
 * Deterministic, zero-AI scoring of a merged PR.
 * Reads PR context from environment variables set by the GitHub Actions workflow.
 *
 * Output (to stdout, JSON):
 *   { score: number, verdict: "SKIP" | "GENERATE" | "GENERATE+ADR", reason: string, area: string }
 *
 * Exit codes:
 *   0 = success (always — caller reads verdict to decide next step)
 */

// ─── Input from env (set by workflow) ────────────────────────────────────────
const filesChanged  = (process.env.FILES_CHANGED  || "").split("\n").filter(Boolean);
const commitMsgs    = (process.env.COMMIT_MESSAGES || "").split("\n").filter(Boolean);
const prLabels      = (process.env.PR_LABELS       || "").split(",").map(s => s.trim().toLowerCase());
const linesChanged  = parseInt(process.env.LINES_CHANGED || "0", 10);
const prTitle       = (process.env.PR_TITLE        || "").toLowerCase();

// ─── Constants ────────────────────────────────────────────────────────────────

/** PR author — Dependabot PRs are always skipped (dependency bumps = no architectural value) */
const prAuthor = (process.env.PR_AUTHOR || "").toLowerCase();

/** Commit type prefixes that always trigger a skip */
const SKIP_COMMIT_TYPES = ["docs:", "style:", "chore:", "chore(deps):", "chore(deps-dev):", "ci:", "build:", "test:"];

/** File patterns that, when ALL changes are in these, trigger a skip */
const DOCS_ONLY_PATTERNS = [
  /^README\.md$/i,
  /^docs\//,
  /^\.github\/ISSUE_TEMPLATE\//,
  /^\.github\/PULL_REQUEST_TEMPLATE/,
  /^\.prettierrc/,
  /^\.eslintrc/,
  /^LICENSE/,
  /^CODE_OF_CONDUCT/,
  /^CONTRIBUTING/,
];

/** Scoring rules: { pattern, score, area } — first match per file wins */
const SCORING_RULES = [
  { pattern: /^supabase\/migrations\//,            score: 10, area: "Database"  },
  { pattern: /^apps\/api\/src\/routes\//,           score: 9,  area: "Backend"  },
  { pattern: /^apps\/api\/src\/services\//,         score: 8,  area: "Backend"  },
  { pattern: /^apps\/api\/src\/middleware\//,       score: 7,  area: "Backend"  },
  { pattern: /^apps\/ml\//,                         score: 8,  area: "ML/AI"    },
  { pattern: /^packages\/shared\//,                 score: 7,  area: "Shared"   },
  { pattern: /^apps\/api\/src\//,                   score: 6,  area: "Backend"  },
  { pattern: /^apps\/web\/app\//,                   score: 5,  area: "Frontend" },
  { pattern: /^apps\/web\/components\//,            score: 5,  area: "Frontend" },
  { pattern: /^apps\/web\/hooks\//,                 score: 5,  area: "Frontend" },
  { pattern: /^apps\/web\/lib\//,                   score: 4,  area: "Frontend" },
  { pattern: /^apps\/web\/messages\//,              score: 3,  area: "i18n"     },
  { pattern: /^apps\/web\//,                        score: 3,  area: "Frontend" },
  { pattern: /^\.github\/workflows\//,              score: 4,  area: "DevOps"   },
  { pattern: /package\.json$/,                      score: 4,  area: "DevOps"   },
  { pattern: /docker-compose/i,                     score: 4,  area: "DevOps"   },
  { pattern: /Dockerfile/,                          score: 4,  area: "DevOps"   },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function allFilesAreDocsOnly(files) {
  return files.length > 0 && files.every(f => DOCS_ONLY_PATTERNS.some(p => p.test(f)));
}

function hasSkipCommitType(msgs) {
  return msgs.some(msg =>
    SKIP_COMMIT_TYPES.some(prefix => msg.trim().toLowerCase().startsWith(prefix))
  );
}

function detectArea(files) {
  const counts = {};
  for (const file of files) {
    for (const rule of SCORING_RULES) {
      if (rule.pattern.test(file)) {
        counts[rule.area] = (counts[rule.area] || 0) + 1;
        break;
      }
    }
  }
  // Return the area with the most files changed
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "General";
}

// ─── Main Scoring Logic ───────────────────────────────────────────────────────

function score() {
  // --- Hard skips (no score needed) ---

  if (prLabels.includes("skip-devtrack")) {
    return { score: 0, verdict: "SKIP", reason: "Label 'skip-devtrack' applied by maintainer", area: "N/A" };
  }

  // Skip Dependabot PRs — dependency bumps have no architectural documentation value
  if (prAuthor === "app/dependabot" || prAuthor === "dependabot[bot]" || prAuthor === "dependabot") {
    return { score: 0, verdict: "SKIP", reason: "Dependabot dependency update — no architectural docs needed", area: "N/A" };
  }

  if (linesChanged < 20) {
    return { score: 0, verdict: "SKIP", reason: `Only ${linesChanged} lines changed (threshold: 20)`, area: "N/A" };
  }

  if (allFilesAreDocsOnly(filesChanged)) {
    return { score: 0, verdict: "SKIP", reason: "Only documentation files changed (README, docs/, templates)", area: "N/A" };
  }

  if (hasSkipCommitType(commitMsgs)) {
    const matched = commitMsgs.find(m => SKIP_COMMIT_TYPES.some(p => m.trim().toLowerCase().startsWith(p)));
    return { score: 0, verdict: "SKIP", reason: `Commit type skipped: "${matched}"`, area: "N/A" };
  }

  // --- File-based scoring ---
  let totalScore = 0;
  const scoredFiles = new Set();

  for (const file of filesChanged) {
    for (const rule of SCORING_RULES) {
      if (rule.pattern.test(file) && !scoredFiles.has(file)) {
        totalScore += rule.score;
        scoredFiles.add(file);
        break; // first matching rule per file
      }
    }
  }

  // Bonus: large PRs touching many files across multiple areas
  const areasHit = new Set(
    filesChanged.map(f => {
      for (const rule of SCORING_RULES) {
        if (rule.pattern.test(f)) return rule.area;
      }
      return null;
    }).filter(Boolean)
  );
  if (areasHit.size >= 3) totalScore += 5; // cross-cutting PR bonus

  // Penalty: fix: commits (important but lower priority than features)
  const isOnlyFixes = commitMsgs.length > 0 && commitMsgs.every(m => m.trim().toLowerCase().startsWith("fix:"));
  if (isOnlyFixes) totalScore = Math.floor(totalScore / 2);

  // --- Verdict ---
  const area = detectArea(filesChanged);

  if (totalScore < 5) {
    return { score: totalScore, verdict: "SKIP", reason: `Impact score ${totalScore} below threshold (5)`, area };
  }

  if (totalScore >= 15) {
    return { score: totalScore, verdict: "GENERATE+ADR", reason: `High architectural impact (score: ${totalScore})`, area };
  }

  return { score: totalScore, verdict: "GENERATE", reason: `Meaningful change (score: ${totalScore})`, area };
}

// ─── Output ───────────────────────────────────────────────────────────────────

const result = score();
console.log(JSON.stringify(result, null, 2));

// Also write to GITHUB_OUTPUT if in Actions environment
if (process.env.GITHUB_OUTPUT) {
  const { writeFileSync, appendFileSync } = await import("fs");
  const out = process.env.GITHUB_OUTPUT;
  appendFileSync(out, `verdict=${result.verdict}\n`);
  appendFileSync(out, `score=${result.score}\n`);
  appendFileSync(out, `area=${result.area}\n`);
  appendFileSync(out, `reason=${result.reason}\n`);
}
