# PR #1756 — feat(workflow): implement strict creator-only assignment and auto-cle…

> **Merged:** 2026-06-12 | **Author:** @dipexplorer | **Area:** DevOps | **Impact Score:** 8

## What Changed

This PR significantly refines our issue assignment process and introduces automated comment cleanup. We now enforce that initial issue assignments are restricted to the issue creator unless the issue is explicitly marked with the `status: open-for-all` label. Assignment requests lacking a brief implementation approach are automatically denied, and their corresponding comments are deleted to reduce noise. Furthermore, upon successful assignment, particularly for issues previously marked `open-for-all`, our system now automatically cleans up previous bot notifications and spammy user assignment requests. Finally, when an assignee is automatically unassigned due to inactivity, the `status: open-for-all` label is automatically added to the issue, making it available for general contribution. A manual cleanup script `scripts/clean-issue-spam.sh` was also added for ad-hoc comment moderation.

## The Problem Being Solved

Prior to this change, our issue assignment workflow was prone to inefficiencies and spam. Contributors could claim issues without demonstrating a clear understanding or plan, often leading to prolonged inactivity and stalled progress. There was also no mechanism to prioritize the issue creator for initial assignment, which could lead to frustration if others claimed issues the creator intended to work on. Our issue comment threads frequently became cluttered with repetitive bot messages (e.g., assignment confirmations, unassignment notices, warnings) and numerous short, uninformative `/assign` requests from users. This "comment spam" made it difficult for maintainers and contributors to track meaningful discussions and the actual status of issues, requiring tedious manual moderation.

## Files Modified

- `.github/workflows/auto-assign.yml`
- `.github/workflows/auto-unassign.yml`
- `scripts/clean-issue-spam.sh`

## Implementation Details

The core logic for these enhancements is integrated into our existing GitHub Actions workflows, primarily within `.github/workflows/auto-assign.yml` and `.github/workflows/auto-unassign.yml`, with a supplementary manual script `scripts/clean-issue-spam.sh`.

### `.github/workflows/auto-assign.yml` Modifications:

1.  **Blocking Empty Assignment Requests:**
    *   A new JavaScript block was inserted at the beginning of the `on: issue_comment` `types: [created]` job.
    *   It extracts the `commentBody` from `context.payload.comment.body`.
    *   The `commentBody` is then cleaned by removing newlines (`replace(/\r?\n|\r/g, ' ')`) and common assignment phrases like `/assign`, `please assign me`, `assign me` (case-insensitive, `replace(/.../ig, '')`). The result is `trim()`med to form `cleanedBody`.
    *   If `cleanedBody.length < 30`, the system logs a rejection via `core.info`.
    *   A denial comment is posted to the issue using `github.rest.issues.createComment`, explaining the requirement for an implementation approach.
    *   The original, empty assignment request comment is then deleted using `github.rest.issues.deleteComment`. A `try/catch` block handles potential deletion errors, logging a `core.warning`.
    *   The workflow execution is halted for this comment by a `return` statement.

2.  **Strict Creator-Only Assignment:**
    *   Further down, a new conditional block enforces initial creator-only assignment.
    *   It checks if the issue is currently unassigned (`isUnassigned`) and if it *does not* have the `status: open-for-all` label. The `hasOpenForAllLabel` flag is determined by iterating `issueData.data.labels` and checking `l.name` (or `l` if a string) for a case-insensitive match.
    *   If these conditions are met, it compares the `commenter` (`context.payload.comment.user.login`) with the `issueAuthor` (`issueData.data.user.login`).
    *   If `commenter !== issueAuthor`, the assignment is rejected. A denial comment is posted via `github.rest.issues.createComment`, explaining that only the creator can claim it.
    *   The original assignment request comment is deleted using `github.rest.issues.deleteComment` (with a silent `try/catch` for deletion errors).
    *   The workflow execution is halted by a `return` statement.

3.  **Automated Cleanup on Re-Assignment:**
    *   After a successful assignment (specifically if `hasOpenForAllLabel` was true, indicating a transition from an open-for-all state), a cleanup routine is executed.
    *   The `status: open-for-all` label is immediately removed from the issue using `github.rest.issues.removeLabel`.
    *   All comments on the issue are fetched using `github.paginate(github.rest.issues.listComments)`.
    *   The system iterates through each comment (`c`):
        *   The current comment that triggered the assignment (`context.payload.comment.id`) is skipped.
        *   **Bot Comments:** If `c.user.login === 'github-actions[bot]'`, the `c.body` is checked for patterns like `⚠️`, `You've been assigned`, `Assignment Request Denied`, `already assigned`, `Auto-unassigned`, or `inactivity` (case-insensitive). If a match is found, `shouldDelete` is set to `true`.
        *   **User Comments:** If `c.user.login` is not the bot, `c.body` is cleaned using the same logic as for blocking empty requests. If the `cCleaned.length < 30` and `c.body` contains an assignment phrase, `shouldDelete` is set to `true`.
        *   If `shouldDelete` is `true`, the comment is deleted using `github.rest.issues.deleteComment`. A `try/catch` block handles and logs any errors during this process.

### `.github/workflows/auto-unassign.yml` Modifications:

1.  **Add `status: open-for-all` on Unassignment:**
    *   Within the `unassign-inactive` job, after an assignee is successfully removed from an issue using `github.rest.issues.removeAssignees`, a new step is added.
    *   This step uses `github.rest.issues.addLabels` to apply the `status: open-for-all` label to the issue. This makes the issue immediately available for other contributors to claim. A `try/catch` block logs warnings if the label addition fails.

### `scripts/clean-issue-spam.sh` (New File):

1.  This is a new bash script designed for manual, ad-hoc cleanup of spam comments on a specific issue.
2.  It takes an `issue_number` as its first argument.
3.  It uses the `gh api` command-line tool to fetch all comments for the specified issue.
4.  `jq -c '.[] | {id: .id, author: .user.login, body: .body}'` is used to parse the JSON response, extracting the comment ID, author, and body.
5.  The script iterates through each comment:
    *   It identifies bot comments (`AUTHOR = "github-actions[bot]"`) that match assignment/warning/unassignment patterns (similar to the `auto-assign.yml` logic).
    *   It identifies user comments (`AUTHOR != "github-actions[bot]"`) that are short and contain assignment requests. The `CLEANED_BODY` is generated using `sed -E 's/\/assign|please assign me|assign me//Ig' | tr -d '\n\r' | awk '{$1=$1;print}'` for shell-based string manipulation.
    *   If a comment is marked for deletion, `gh api -X DELETE /repos/{owner}/{repo}/issues/comments/$ID --silent` is executed to remove it. Error messages are printed if deletion fails, indicating potential permission issues.

## Technical Decisions

1.  **Leveraging GitHub Actions for Workflow Automation:** We chose to embed the new assignment and cleanup logic directly into our existing GitHub Actions workflows. This decision ensures that these processes are automatically triggered by relevant GitHub events (like `issue_comment` creation or scheduled checks), providing real-time enforcement and reducing manual intervention. It also keeps the automation logic version-controlled alongside our codebase.
2.  **JavaScript for Complex Logic:** The use of JavaScript within the `actions/github-script` steps in the workflows was chosen for its flexibility in handling complex conditional logic, string manipulation, and direct interaction with the GitHub REST API via the `github` context object (an authenticated Octokit client). This is more powerful and maintainable than attempting to implement such logic purely in shell scripts within the YAML.
3.  **`status: open-for-all` Label as a Policy Override:** Introducing the `status: open-for-all` label provides a clear, explicit mechanism for maintainers to override the default creator-only assignment policy. This allows us to balance the strictness of initial assignment with the need to open up issues for broader community contribution when appropriate, particularly after an initial assignee becomes inactive.
4.  **Heuristic-Based Spam Detection:** For identifying "empty" or "spammy" assignment requests, we opted for a heuristic approach based on the length of the comment body after stripping common assignment phrases. While not a full NLP solution, this `cleanedBody.length < 30` threshold provides a practical and effective way to filter out low-effort requests without over-engineering the solution.
5.  **Proactive Comment Deletion:** The decision to *delete* spam comments (both bot-generated and user-generated) rather than merely ignoring them was made to actively maintain clean and readable issue threads. This directly addresses the problem of cluttered discussions and improves the overall experience for all contributors and maintainers.
6.  **`gh` CLI and `jq` for Manual Script:** For the `clean-issue-spam.sh` script, using the `gh` command-line tool's `api` subcommand combined with `jq` for JSON parsing is the standard and most robust way to interact with the GitHub API from a shell environment. This avoids external dependencies and complex `curl` commands, making the script easy to use and understand for maintainers.

## How To Re-Implement (Contributor Reference)

To re-implement or deeply understand the mechanisms introduced by this PR, a contributor should focus on the following patterns and API interactions:

1.  **GitHub Actions Workflow Structure:** Understand the `on:` triggers (`issue_comment`, `schedule`), `jobs:`, `steps:`, and the use of `uses: actions/github-script@v6` for executing JavaScript.
2.  **GitHub REST API via `github` Context:**
    *   `github.rest.issues.createComment({ owner, repo, issue_number, body })`: To post new comments.
    *   `github.rest.issues.deleteComment({ owner, repo, comment_id })`: To remove specific comments.
    *   `github.rest.issues.addLabels({ owner, repo, issue_number, labels: [...] })`: To add labels to an issue.
    *   `github.rest.issues.removeLabel({ owner, repo, issue_number, name })`: To remove a specific label.
    *   `github.paginate(github.rest.issues.listComments, { owner, repo, issue_number, per_page: 100 })`: To efficiently fetch all comments for an issue, handling pagination automatically.
3.  **JavaScript String Manipulation for Spam Detection:**
    *   To clean comment bodies:
        ```javascript
        const rawBody = context.payload.comment.body;
        const cleanedBody = rawBody.replace(/\r?\n|\r/g, ' ').replace(/\/assign|please assign me|assign me/ig, '').trim();
        // Check cleanedBody.length < 30 for spam
        ```
    *   To detect bot spam patterns:
        ```javascript
        const botBody = c.body || '';
        if (botBody.match(/(⚠️|You've been assigned|Assignment Request Denied|already assigned|Auto-unassigned|inactivity)/i)) {
            // This is bot spam
        }
        ```
4.  **Conditional Logic for Assignment Flow:**
    *   Retrieve `issueAuthor` from `issueData.data.user.login` and `commenter` from `context.payload.comment.user.login`.
    *   Check `isUnassigned` (if `issueData.data.assignees.length === 0`).
    *   Determine `hasOpenForAllLabel` by iterating `issueData.data.labels` and checking `(typeof l === 'string' ? l : l.name).toLowerCase() === 'status: open-for-all'`.
    *   Use `if (isUnassigned && !hasOpenForAllLabel && commenter !== issueAuthor)` for creator-only logic.
5.  **Shell Scripting with `gh` CLI and `jq`:**
    *   To fetch comments: `gh api /repos/{owner}/{repo}/issues/$ISSUE_NUM/comments | jq -c '.[] | {id: .id, author: .user.login, body: .body}'`
    *   To clean comment bodies in shell: `echo "$BODY" | sed -E 's/\/assign|please assign me|assign me//Ig' | tr -d '\n\r' | awk '{$1=$1;print}'`
    *   To delete comments: `gh api -X DELETE /repos/{owner}/{repo}/issues/comments/$ID --silent`

**Gotchas:**
*   **Permissions:** Ensure the GitHub Actions token (`GITHUB_TOKEN`) or personal access token used by `gh api` has sufficient `issues: write` and `contents: write` permissions to create/delete comments and manage labels.
*   **Rate Limits:** `github.paginate` handles pagination, but frequent API calls in a tight loop can still hit rate limits. The current implementation is generally safe for typical issue volumes.
*   **Error Handling:** Implement `try/catch` blocks around API calls in JavaScript and use `|| echo "Failed..."` for shell commands to gracefully handle API failures.

## Impact on System Architecture

This PR significantly strengthens the governance and cleanliness of our SahiDawa issue tracking system. By implementing stricter assignment rules, we reduce the likelihood of issues being claimed and then abandoned, thereby improving the overall velocity of contributions. The `status: open-for-all` label introduces a clear, automated lifecycle for issues, making it transparent when an issue is reserved for its creator versus when it's available for general contribution. The automated and manual comment cleanup mechanisms drastically reduce noise and clutter in issue threads, making them more focused on problem-solving and collaboration. This directly enhances the contributor experience by providing a clearer, less spam-filled environment, and reduces the manual moderation burden on our maintainers. Architecturally, it solidifies our DevOps practices around issue management, making the SahiDawa platform more efficient and welcoming for open-source contributions.

## Testing & Verification

Verification of these changes involved a comprehensive set of tests covering various scenarios:

1.  **Empty Assignment Request Test:**
    *   A non-maintainer user commented `/assign` or a very short message like "hi /assign" on an unassigned issue.
    *   **Expected Outcome:** The `auto-assign.yml` workflow posted a denial comment (e.g., "Assignment Request Denied... must provide a brief implementation approach") and successfully deleted the original spammy comment. No assignment occurred.
2.  **Creator-Only Assignment Test (Initial Claim):**
    *   **Scenario A:** An issue creator commented `/assign` on their own newly created, unassigned issue (without `status: open-for-all`).
    *   **Expected Outcome:** The creator was successfully assigned to the issue.
    *   **Scenario B:** A non-creator commented `/assign` on an unassigned issue created by someone else (without `status: open-for-all`).
    *   **Expected Outcome:** The `auto-assign.yml` workflow posted a denial comment (e.g., "Assignment Request Denied... only the creator... can claim it") and deleted the non-creator's assignment request comment. No assignment occurred.
3.  **`status: open-for-all` Assignment Test:**
    *   An issue was manually labeled `status: open-for-all` and left unassigned. A non-creator contributor commented `/assign`.
    *   **Expected Outcome:** The contributor was successfully assigned. The `status: open-for-all` label was automatically removed by the `auto-assign.yml` workflow.
4.  **Automated Cleanup on Re-Assignment Test:**
    *   An issue was set up with `status: open-for-all` and contained various bot comments (e.g., previous unassignment notices, assignment warnings) and short `/assign` comments from multiple users. A new user then successfully claimed the issue.
    *   **Expected Outcome:** The new user was assigned, the `status: open-for-all` label was removed, and all previous bot and spammy user comments were automatically deleted, leaving a clean issue thread.
5.  **Auto-Unassignment with Label Addition Test:**
    *   An issue was assigned to a test user, and then the `auto-unassign.yml` workflow was manually triggered or allowed to run on schedule, simulating inactivity.
    *   **Expected Outcome:** The test user was unassigned from the issue, and the `status: open-for-all` label was successfully added to the issue.
6.  **Manual Cleanup Script Test (`scripts/clean-issue-spam.sh`):**
    *   The `scripts/clean-issue-spam.sh` script was executed with an `issue_number` known to contain various types of bot and user spam comments.
    *   **Expected Outcome:** The script correctly identified and deleted the targeted comments, logging each deletion action to the console.

**Edge Cases Considered:**
*   **API Rate Limits:** The use of `github.paginate` for fetching comments helps mitigate rate limit issues by handling large numbers of comments efficiently.
*   **Permissions:** `try/catch` blocks are used around GitHub API calls in the workflows to prevent complete workflow failure if a deletion or label operation encounters a permission error, instead logging a warning. The manual script also includes error messages for failed deletions.
*   **False Positives:** The `cleanedBody.length < 30` heuristic for spam detection was chosen to be reasonably strict but still allow for concise, legitimate implementation approaches. We will monitor for any false positives in production.
*   **Concurrent Assignments:** The existing 3-issue assignment cap and the `isUnassigned` check in `auto-assign.yml` already handle most race conditions for assignments. The new cleanup logic further ensures that even if multiple denial comments are posted, they are eventually cleaned up upon a successful assignment.