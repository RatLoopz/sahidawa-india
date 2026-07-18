# PR #3653 — feat: integrate Lighthouse CI for automated performance and accessibility auditing

> **Merged:** 2026-07-17 | **Author:** @TanCodeX | **Area:** DevOps | **Impact Score:** 7 | **Closes:** #3652

## What Changed

We integrated Lighthouse CI into our GitHub Actions workflow to automate performance and accessibility auditing for our web application. This change adds a new workflow file `.github/workflows/lighthouse.yml` that runs Lighthouse audits on every pull request and push to the `main` branch. We also created a `lighthouserc.json` configuration file in `apps/web` to define the audit settings, including the minimum score requirements for performance, accessibility, best practices, and SEO. Additionally, we updated the `README.md` file to include instructions for running Lighthouse locally.

## The Problem Being Solved

Before this PR, we lacked automated performance and accessibility auditing for our web application. This made it difficult to ensure that our application met the required standards for performance and accessibility, which could lead to a poor user experience and potential issues with search engine optimization (SEO). By integrating Lighthouse CI, we can now automatically run audits and enforce quality gates to ensure that our application meets the minimum score requirements.

## Files Modified

- `.github/workflows/lighthouse.yml`
- `README.md`
- `apps/web/lighthouserc.json`

## Implementation Details

We implemented the Lighthouse CI integration using GitHub Actions, which allows us to run audits automatically on every pull request and push to the `main` branch. The `.github/workflows/lighthouse.yml` file defines the workflow, which includes steps to checkout the code, setup Node.js, install dependencies, cache Turborepo, build the web application, and run the Lighthouse audit. We used the `@lhci/cli` package to run the audit and configured it to use the `lighthouserc.json` file for settings. The `lighthouserc.json` file defines the audit settings, including the minimum score requirements for performance, accessibility, best practices, and SEO.

## Technical Decisions

We chose to use Lighthouse CI because it provides a comprehensive set of audits for performance, accessibility, best practices, and SEO. We also chose to use GitHub Actions because it allows us to automate the audit process and integrate it with our existing workflow. We considered using other tools, such as WebPageTest, but Lighthouse CI provided the most comprehensive set of audits and was easiest to integrate with our existing workflow.

## How To Re-Implement (Contributor Reference)

To re-implement this feature from scratch, follow these steps:

1. Create a new file `.github/workflows/lighthouse.yml` and define the workflow, including the steps to checkout the code, setup Node.js, install dependencies, cache Turborepo, build the web application, and run the Lighthouse audit.
2. Create a new file `apps/web/lighthouserc.json` and define the audit settings, including the minimum score requirements for performance, accessibility, best practices, and SEO.
3. Update the `README.md` file to include instructions for running Lighthouse locally.
4. Install the `@lhci/cli` package and configure it to use the `lighthouserc.json` file for settings.
5. Test the workflow by running it manually and verifying that the audit runs successfully and enforces the quality gates.

## Impact on System Architecture

This change adds a new workflow to our GitHub Actions configuration, which automates the performance and accessibility auditing process for our web application. This change unlocks the ability to enforce quality gates and ensure that our application meets the required standards for performance and accessibility. It also provides a comprehensive set of audits that can be used to identify areas for improvement and optimize the application for better performance and user experience.

## Testing & Verification

We tested this change by running the workflow manually and verifying that the audit runs successfully and enforces the quality gates. We also verified that the `lighthouserc.json` file is used correctly and that the minimum score requirements are enforced. To test this change, contributors can follow these steps:

1. Run the workflow manually by triggering a push event to the `main` branch.
2. Verify that the audit runs successfully and enforces the quality gates.
3. Check the workflow logs to ensure that the audit settings are used correctly and that the minimum score requirements are enforced.
4. Test the workflow with different scenarios, such as a pull request with a low performance score, to ensure that the quality gates are enforced correctly.