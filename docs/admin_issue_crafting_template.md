# Admin Issue Crafting Template

Use this template to write high-quality, actionable, and spam-resistant GitHub issues for GSSoC contributors.

## Issue Title Format

`[TYPE] Short descriptive title (e.g. [BUG] Timezone Mismatch in Scheduler or [FEATURE] CSV Export for Scan History)`

## Issue Body Markdown Template

```markdown
### Description

[Provide a clear explanation of the bug, security issue, or feature. Describe the context and why this change is necessary.]

### Affected Components & Codebases

[List the involved services, e.g., apps/web, apps/api, apps/ml, apps/etl]

### Expected Behavior & Acceptance Criteria

- [ ] [Requirement 1: e.g., Validates input values correctly]
- [ ] [Requirement 2: e.g., Returns 400 Bad Request if validation fails]
- [ ] [Requirement 3: e.g., Added unit tests for the new logic]

### Affected Files

[Specify exact file paths to help contributors find the code:]

- `apps/path/to/target/file.ts`

---

### ⚠️ Contributor Instructions (Please Read Carefully)

- **Do NOT spam "/assign" or "Please assign me".**
- To claim this task, you MUST reply with a brief **proposed implementation plan/approach**. What files will you touch? How will you solve it?
- Once your approach is reviewed and approved by a maintainer, you will be officially assigned.
- Any PR opened without prior assignment and approach approval will be closed.
```

## Required GSSoC Labels Checklist

When creating the issue, add the following labels:

1. `gssoc:approved` (Must be applied so contributors know it is active)
2. **Exactly one difficulty label**:
    - `level:beginner` (Typo fixes, simple UI tweaks, self-contained adjustments)
    - `level:intermediate` (Form validation, multi-file bugs, API route updates)
    - `level:advanced` (Core routing, optimization, complex backend tasks)
    - `level:critical` (Auth, database migration, security patches, deployment)
3. **One or more type labels**:
    - `type:bug` (Fixes incorrect behavior)
    - `type:feature` (Adds new functionality)
    - `type:docs` (Improves comments or documentation)
    - `type:testing` (Adds unit or integration tests)
    - `type:refactor` (Code cleanup / structure optimization)
    - `type:design` (Visual UI/UX improvements)
    - `type:accessibility` (Screen readers, ARIA, keyboard nav)
    - `type:performance` (Reduces load times, bundle sizes, database CPU load)
    - `type:security` (Fixes vulnerabilities, abuse safeguards, rate limiters)
    - `type:devops` (CI/CD workflows, Docker, package changes)
