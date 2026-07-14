#!/usr/bin/env node
/**
 * SahiDawa DevTrack — AI Documentation Generator
 *
 * Reads PR context from environment variables, calls the Gemini API,
 * and writes the generated markdown doc to the correct path under docs/devtrack/.
 *
 * Requires:
 *   GEMINI_API_KEY   — Google AI Studio API key (from GitHub secret)
 *   PR_NUMBER        — e.g. "42"
 *   PR_TITLE         — e.g. "feat: add barcode scanner"
 *   PR_BODY          — PR description markdown
 *   PR_AUTHOR        — GitHub username
 *   PR_MERGED_AT     — ISO date string
 *   FILES_CHANGED    — newline-separated list
 *   COMMIT_MESSAGES  — newline-separated list
 *   LINKED_ISSUE     — e.g. "#15" or ""
 *   PR_LABELS        — comma-separated labels
 *   IMPACT_SCORE     — numeric score from score-impact.mjs
 *   IMPACT_AREA      — e.g. "Backend"
 *   VERDICT          — "GENERATE" or "GENERATE+ADR"
 *   GIT_DIFF         — truncated diff (max 150KB)
 *   REPO_SLUG        — e.g. "RatLoopz/sahidawa-india"
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, appendFileSync } from "fs";
import { join, dirname } from "path";

// ─── Config ───────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is not set. Add it as a GitHub Actions secret named GEMINI_API_KEY.");
  process.exit(1);
}

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const MAX_DIFF_CHARS = 12000; // Stay well within context limits

// ─── Input ────────────────────────────────────────────────────────────────────

const ctx = {
  prNumber:      process.env.PR_NUMBER      || "0",
  prTitle:       process.env.PR_TITLE       || "Untitled PR",
  prBody:        process.env.PR_BODY        || "No description provided.",
  prAuthor:      process.env.PR_AUTHOR      || "unknown",
  prMergedAt:    process.env.PR_MERGED_AT   || new Date().toISOString(),
  filesChanged:  (process.env.FILES_CHANGED || "").split("\n").filter(Boolean),
  commitMsgs:    (process.env.COMMIT_MESSAGES || "").split("\n").filter(Boolean),
  linkedIssue:   process.env.LINKED_ISSUE   || "",
  labels:        process.env.PR_LABELS      || "",
  score:         process.env.IMPACT_SCORE   || "0",
  area:          process.env.IMPACT_AREA    || "General",
  verdict:       process.env.VERDICT        || "GENERATE",
  gitDiff:       (process.env.GIT_DIFF      || "").slice(0, MAX_DIFF_CHARS),
  repoSlug:      process.env.REPO_SLUG      || "RatLoopz/sahidawa-india",
};

const mergedDate  = new Date(ctx.prMergedAt);
const yearMonth   = `${mergedDate.getFullYear()}-${String(mergedDate.getMonth() + 1).padStart(2, "0")}`;
const dateStr     = mergedDate.toISOString().split("T")[0];
const prSlug      = ctx.prTitle
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 50);

// ─── Gemini API Call ──────────────────────────────────────────────────────────

async function callGemini(prompt, retries = 3) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
  };

  let lastErr = "";
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(GEMINI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.text();
        if (response.status === 429 || response.status === 503 || response.status === 500) {
          console.warn(`⚠️ Gemini API error ${response.status} on attempt ${attempt}: ${err}`);
          lastErr = `Gemini API error ${response.status}: ${err}`;
          if (attempt < retries) {
            const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
            console.log(`⏳ Retrying in ${Math.round(delay / 1000)}s...`);
            await new Promise(res => setTimeout(res, delay));
            continue;
          }
        }
        throw new Error(`Gemini API error ${response.status}: ${err}`);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      
      if (!candidate) {
        console.error("Gemini API returned no candidates:", JSON.stringify(data, null, 2));
        throw new Error("No candidates returned from Gemini API.");
      }
      
      if (candidate.finishReason && candidate.finishReason !== "STOP") {
        console.warn(`⚠️ Warning: Gemini generation stopped early! Reason: ${candidate.finishReason}`);
      }

      const text = candidate.content?.parts?.[0]?.text || "";
      
      if (!text.trim()) {
        console.error("Gemini API returned empty text. Full response:", JSON.stringify(data, null, 2));
      }

      return text;
    } catch (e) {
      lastErr = e.message;
      if (attempt < retries && e.message.includes("fetch")) {
         const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
         console.log(`⏳ Network error. Retrying in ${Math.round(delay / 1000)}s...`);
         await new Promise(res => setTimeout(res, delay));
         continue;
      }
      throw e;
    }
  }
  throw new Error(`Failed after ${retries} attempts. Last error: ${lastErr}`);
}

async function callGroq(prompt) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set.");
  }
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const body = {
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: "You are an expert technical writer and software architect." },
      { role: "user", content: prompt }
    ],
    temperature: 0.3
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  if (!text.trim()) {
    console.error("Groq API returned empty text. Full response:", JSON.stringify(data, null, 2));
  }
  return text;
}

async function callAI(prompt) {
  try {
    return await callGemini(prompt);
  } catch (err) {
    console.warn(`⚠️ Gemini failed: ${err.message}`);
    console.log("⏳ Falling back to Groq API...");
    return await callGroq(prompt);
  }
}

// ─── Prompt Templates ─────────────────────────────────────────────────────────

function buildPRDocPrompt() {
  return `You are the engineering documentation system for SahiDawa — an open-source Indian medicine verification and rural health platform. A pull request was just merged. Write a structured knowledge document for this change.

CRITICAL RULES:
- Write in first person as the SahiDawa engineering team ("we", "our system")
- Be highly specific and technical — reference actual file names, function names, library names from the diff
- Focus on WHY decisions were made, not just WHAT was done
- Even if the PR is very small (e.g., adding a single test script), write a comprehensive, easy-to-understand explanation of what it does and why it was added. Provide context!
- If you cannot determine something clearly from the data, write exactly: "Not documented in this PR"
- Do NOT add any preamble, intro, or closing remarks — output ONLY the markdown document
- Do NOT use placeholder text like "Lorem ipsum" or "[insert here]"
- The Implementation Notes section must be detailed enough for a contributor to re-implement the feature or understand the exact flow.
- Ensure the document is complete. Do not stop mid-sentence.

=== PR DATA ===

PR Number: #${ctx.prNumber}
PR Title: ${ctx.prTitle}
Author: @${ctx.prAuthor}
Merged At: ${dateStr}
Impact Area: ${ctx.area}
Impact Score: ${ctx.score}/30
Labels: ${ctx.labels || "none"}
Linked Issue: ${ctx.linkedIssue || "none"}

PR Description:
${ctx.prBody || "No description provided."}

Files Changed (${ctx.filesChanged.length} files):
${ctx.filesChanged.map(f => `- ${f}`).join("\n")}

Commit Messages:
${ctx.commitMsgs.map(m => `- ${m}`).join("\n")}

Git Diff (truncated if large):
\`\`\`diff
${ctx.gitDiff || "Diff not available"}
\`\`\`

=== REQUIRED OUTPUT FORMAT ===
Output ONLY this markdown, filled in with real content:

# PR #${ctx.prNumber} — ${ctx.prTitle}

> **Merged:** ${dateStr} | **Author:** @${ctx.prAuthor} | **Area:** ${ctx.area} | **Impact Score:** ${ctx.score}${ctx.linkedIssue ? ` | **Closes:** ${ctx.linkedIssue}` : ""}

## What Changed

[2-4 sentences: the concrete change this PR makes to the system]

## The Problem Being Solved

[What was broken, missing, or inefficient before this PR? Be specific.]

## Files Modified

${ctx.filesChanged.map(f => `- \`${f}\``).join("\n")}

## Implementation Details

[Technical deep-dive: what was implemented, how it works, key functions/classes/APIs used. Detailed enough for a contributor to understand the code without reading it.]

## Technical Decisions

[Why were specific libraries, patterns, or approaches chosen? What alternatives were considered?]

## How To Re-Implement (Contributor Reference)

[Step-by-step guide: if someone had to implement this feature from scratch, what would they do? Include code patterns, gotchas, and dependencies.]

## Impact on System Architecture

[How does this change affect the overall SahiDawa system? What does it unlock for future development?]

## Testing & Verification

[How was this change tested? What edge cases exist?]`;
}

function buildADRPrompt() {
  return `You are the architectural documentation system for SahiDawa — an open-source Indian medicine verification and rural health platform. A high-impact pull request was just merged that represents a significant architectural decision. Write an Architecture Decision Record (ADR).

CRITICAL RULES:
- Write concisely and technically — this is a permanent record, not a tutorial
- If you cannot determine alternatives clearly from the data, list at least 2 plausible alternatives the team might have considered
- Do NOT add preamble or closing — output ONLY the markdown
- Write in past tense for decisions already made

=== PR DATA ===

PR Title: ${ctx.prTitle}
PR Description: ${ctx.prBody}
Files Changed: ${ctx.filesChanged.join(", ")}
Commit Messages: ${ctx.commitMsgs.join(" | ")}
Git Diff:
\`\`\`diff
${ctx.gitDiff.slice(0, 4000)}
\`\`\`

=== REQUIRED OUTPUT FORMAT ===

# ADR — ${ctx.prTitle}

> **Date:** ${dateStr} | **PR:** #${ctx.prNumber} | **Status:** Accepted

## Context

[What situation or problem required this architectural decision?]

## Decision

[The specific decision made and how it was implemented.]

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| [Option A] | [Reason] |
| [Option B] | [Reason] |

## Consequences

**Positive:**
- [benefit 1]
- [benefit 2]

**Trade-offs:**
- [limitation or added complexity]

## Related Issues & PRs

- PR #${ctx.prNumber}: ${ctx.prTitle}${ctx.linkedIssue ? `\n- Issue ${ctx.linkedIssue}` : ""}`;
}

// ─── File Writing ─────────────────────────────────────────────────────────────

function writeDoc(content, relativePath) {
  const fullPath = join(process.cwd(), relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf8");
  console.log(`✅ Written: ${relativePath}`);
  return relativePath;
}

function updateIndex() {
  const indexPath = join(process.cwd(), "docs/devtrack/README.md");
  const baseDir = join(process.cwd(), "docs/devtrack");
  const prUrlBase = `https://github.com/${ctx.repoSlug}/pull`;
  
  let entries = [];
  if (existsSync(baseDir)) {
    const yearsMonths = readdirSync(baseDir).filter(f => /^\d{4}-\d{2}$/.test(f));
    
    for (const ym of yearsMonths) {
      const ymPath = join(baseDir, ym);
      const files = readdirSync(ymPath).filter(f => f.startsWith("PR-") && f.endsWith(".md"));
      
      for (const file of files) {
        const filePath = join(ymPath, file);
        const content = readFileSync(filePath, "utf8");
        
        // Frontmatter ya first lines se metadata nikal lo
        // Tumhare buildPRDocPrompt ke mutabik format hai: 
        // > **Merged:** date | **Author:** @user | **Area:** area | **Impact Score:** score
        const metaLine = content.split("\n").find(line => line.startsWith("> **Merged:**"));
        
        if (metaLine) {
          const prMatch = file.match(/^PR-(\d+)-/);
          const prNum = prMatch ? prMatch[1] : "0";
          
          const dateMatch = metaLine.match(/\*\*Merged:\*\* ([^\s\|]+)/);
          const authorMatch = metaLine.match(/\*\*Author:\*\* @([^\s\|]+)/);
          const areaMatch = metaLine.match(/\*\*Area:\*\* ([^\|]+)/);
          const scoreMatch = metaLine.match(/\*\*Impact Score:\*\* ([^\s\|]+)/);
          
          const date = dateMatch ? dateMatch[1] : "N/A";
          const author = authorMatch ? authorMatch[1] : "unknown";
          const area = areaMatch ? areaMatch[1].trim() : "General";
          const score = scoreMatch ? scoreMatch[1] : "0";
          
          // Check karo agar iska koi corresponding ADR hai kya adr folder mein
          const slug = file.replace(/^PR-\d+-/, "").replace(/\.md$/, "");
          const adrDir = join(baseDir, "adr");
          let adrLinkStr = `[View Doc](${ym}/${file})`;
          
          if (existsSync(adrDir)) {
            const adrFiles = readdirSync(adrDir);
            const matchingAdr = adrFiles.find(f => f.endsWith(`${slug}.md`));
            if (matchingAdr) {
              adrLinkStr += ` / [ADR](adr/${matchingAdr})`;
            }
          }
          
          entries.push({
            prNum: parseInt(prNum, 10),
            line: `| [#${prNum}](${prUrlBase}/${prNum}) | ${date} | ${area} | ${score} | @${author} | ${adrLinkStr} |`
          });
        }
      }
    }
  }

  // 2. PR Numbers ke basis par Sort karo (Descending Order - naye PRs upar)
  entries.sort((a, b) => b.prNum - a.prNum);

  // 3. Pura README structure fresh build karo
  const header = `# SahiDawa DevTrack — Knowledge Index

This index is automatically maintained by the DevTrack system.
Every entry represents a merged PR that met the minimum architectural impact threshold.

> For PRs with score ≥ 15, an Architecture Decision Record (ADR) is also generated.

## All Documented Changes

| PR | Date | Area | Score | Author | Docs |
|---|---|---|---|---|---|
${entries.map(e => e.line).join("\n")}
`;

  mkdirSync(dirname(indexPath), { recursive: true });
  writeFileSync(indexPath, header, "utf8");
  console.log("✅ Index dynamically regenerated: docs/devtrack/README.md");
}

function getNextADRNumber() {
  const adrDir = join(process.cwd(), "docs/devtrack/adr");
  if (!existsSync(adrDir)) return "001";
  const files = readdirSync(adrDir).filter(f => /^ADR-\d+/.test(f));
  const nums = files.map(f => parseInt(f.match(/^ADR-(\d+)/)?.[1] || "0", 10));
  return String(Math.max(0, ...nums) + 1).padStart(3, "0");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 DevTrack generating docs for PR #${ctx.prNumber}: "${ctx.prTitle}"`);
  console.log(`   Area: ${ctx.area} | Score: ${ctx.score} | Verdict: ${ctx.verdict}\n`);

  // Generate PR summary doc
  console.log("⏳ Calling AI for PR summary...");
  const prDocContent = await callAI(buildPRDocPrompt());
  const prDocPath = `docs/devtrack/${yearMonth}/PR-${ctx.prNumber}-${prSlug}.md`;
  writeDoc(prDocContent, prDocPath);

  // Generate ADR if applicable
  let adrPath = null;
  if (ctx.verdict === "GENERATE+ADR") {
    console.log("⏳ Calling AI for ADR (high-impact PR)...");
    const adrNumber = getNextADRNumber();
    const adrContent = await callAI(buildADRPrompt());
    adrPath = `docs/devtrack/adr/ADR-${adrNumber}-${prSlug}.md`;
    writeDoc(adrContent, adrPath);
  }

  // Update the index
  updateIndex(prDocPath, adrPath);

  // Write output paths for workflow to use in commit message
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `doc_path=${prDocPath}\n`);
    if (adrPath) appendFileSync(process.env.GITHUB_OUTPUT, `adr_path=${adrPath}\n`);
  }

  console.log(`\n✅ DevTrack complete for PR #${ctx.prNumber}\n`);
}

main().catch(err => {
  console.error("❌ DevTrack generation failed:", err.message);
  process.exit(1);
});
