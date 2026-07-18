# PR #3587 — fix(api): apply CSRF middleware consistently across environments

> **Merged:** 2026-07-14 | **Author:** @shashank03-dev | **Area:** Backend | **Impact Score:** 6 | **Closes:** #3552

## What Changed

We modified the `doubleCsrfProtection` middleware to be mounted unconditionally across all environments. Previously, it was only mounted when `NODE_ENV` was neither `test` nor `development`, leaving routes vulnerable to CSRF attacks in development. The `skipCsrfProtection` callback is now used to conditionally skip CSRF validation only when `NODE_ENV` is `test`. Additionally, a random, ephemeral secret is generated for development environments when `CSRF_SECRET` is not set, ensuring that development works without extra setup.

## The Problem Being Solved

Before this change, our system was vulnerable to CSRF attacks in development environments because the `doubleCsrfProtection` middleware was not mounted. This meant that routes were not protected against cross-site requests, which could lead to security issues. Furthermore, the lack of CSRF protection in development environments made it difficult to test and identify CSRF-related issues before they reached production.

## Files Modified

- `apps/api/src/app.ts`
- `apps/api/tests/csrfProtection.test.ts`

## Implementation Details

The implementation involves modifying the `doubleCsrfProtection` middleware to be mounted unconditionally. We achieved this by removing the environment check around `app.use(doubleCsrfProtection)` and instead using the `skipCsrfProtection` callback to conditionally skip CSRF validation. The `skipCsrfProtection` callback checks if `NODE_ENV` is `test` and returns `true` if so, effectively skipping CSRF validation in test environments. In development environments, if `CSRF_SECRET` is not set, a random, ephemeral secret is generated using `crypto.randomBytes` to ensure that development works without extra setup. The `getSecret` function has been modified to return this ephemeral secret if `CSRF_SECRET` is not set. A new test file, `csrfProtection.test.ts`, has been added to verify the correct functioning of the CSRF middleware in development environments.

## Technical Decisions

We chose to use the `skipCsrfProtection` callback to conditionally skip CSRF validation because it allows us to keep the middleware mounted across all environments while still skipping validation in test environments. This approach ensures that our system is protected against CSRF attacks in production and development environments while allowing for seamless testing. We also decided to generate a random, ephemeral secret in development environments when `CSRF_SECRET` is not set to ensure that development works without extra setup. This approach provides a good balance between security and developer convenience.

## How To Re-Implement (Contributor Reference)

To re-implement this feature, follow these steps:
1. Modify the `doubleCsrfProtection` middleware to be mounted unconditionally by removing the environment check around `app.use(doubleCsrfProtection)`.
2. Implement the `skipCsrfProtection` callback to conditionally skip CSRF validation based on the `NODE_ENV` environment variable.
3. Modify the `getSecret` function to return a random, ephemeral secret in development environments when `CSRF_SECRET` is not set.
4. Add a new test file to verify the correct functioning of the CSRF middleware in development environments.

## Impact on System Architecture

This change improves the overall security of our system by ensuring that CSRF protection is mounted across all environments. It also provides a more consistent development experience by allowing developers to test CSRF-related issues in development environments. Additionally, this change unlocks future development by providing a solid foundation for building secure and robust APIs.

## Testing & Verification

We tested this change by adding a new test file, `csrfProtection.test.ts`, which verifies the correct functioning of the CSRF middleware in development environments. The test suite loads a fresh app instance under `NODE_ENV=development` and asserts the real double-submit behavior, including rejecting a state-changing POST with no CSRF token and accepting the same POST with a token minted by `/api/csrf-token`. The test suite also covers edge cases, such as when `CSRF_SECRET` is not set in development environments.