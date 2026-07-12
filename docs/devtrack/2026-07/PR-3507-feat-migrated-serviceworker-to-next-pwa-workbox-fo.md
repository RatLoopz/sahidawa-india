# PR #3507 — Feat :Migrated ServiceWorker to next-pwa/Workbox for Automated Precaching#3441

> **Merged:** 2026-07-12 | **Author:** @hrx01-dev | **Area:** Frontend | **Impact Score:** 12 | **Closes:** #3441

## What Changed

We migrated our ServiceWorker configuration to utilize `next-pwa/Workbox` for automated precaching, replacing the manual regex-based approach in `public/sw.js`. This change allows for more efficient and reliable caching of Next.js static assets, while preserving custom event listeners for offline background syncs and medicine expiry push notifications. The `worker/index.js` file now serves as the source of truth for our ServiceWorker configuration, leveraging the `@ducanh2912/next-pwa` plugin's Custom Worker Config feature.

## The Problem Being Solved

Prior to this PR, our ServiceWorker configuration was brittle and relied on manual regex updates in `public/sw.js`. This approach was prone to errors and made it challenging to manage cache versions. Additionally, the custom event listeners for offline background syncs and push notifications were at risk of being overwritten by the generic Workbox configuration. By migrating to `next-pwa/Workbox`, we address these issues and ensure a more robust and maintainable ServiceWorker configuration.

## Files Modified

- `apps/web/next.config.mjs`
- `apps/web/package.json`
- `apps/web/scripts/generate-sw.mjs`
- `apps/web/worker/index.js`

## Implementation Details

The implementation involves using the `@ducanh2912/next-pwa` plugin to generate a ServiceWorker configuration that integrates with Workbox. We created a custom Workbox configuration in `worker/index.js`, which preserves the existing custom event listeners and cache logic. The `next-pwa` plugin is configured in `next.config.mjs` to use the custom Workbox configuration. We also removed the `generate-sw.mjs` script, which was previously used to update the cache version in `public/sw.js`. The `package.json` file was updated to include the `@ducanh2912/next-pwa` dependency.

## Technical Decisions

We chose to use `next-pwa/Workbox` due to its seamless integration with Next.js and its ability to provide automated precaching. The `@ducanh2912/next-pwa` plugin was selected for its Custom Worker Config feature, which allows us to preserve our custom event listeners and cache logic. We considered alternative approaches, such as using a different ServiceWorker library or implementing a custom caching solution, but `next-pwa/Workbox` offered the best balance of ease of use, performance, and maintainability.

## How To Re-Implement (Contributor Reference)

To re-implement this feature, follow these steps:

1. Install the `@ducanh2912/next-pwa` plugin by running `npm install @ducanh2912/next-pwa` or `yarn add @ducanh2912/next-pwa`.
2. Configure the `next-pwa` plugin in `next.config.mjs` by importing the `withPWAInit` function and creating a custom Workbox configuration.
3. Create a `worker/index.js` file to serve as the source of truth for your ServiceWorker configuration.
4. Preserve existing custom event listeners and cache logic in `worker/index.js`.
5. Remove any scripts or configuration files that are no longer necessary, such as `generate-sw.mjs`.
6. Update the `package.json` file to include the `@ducanh2912/next-pwa` dependency.

## Impact on System Architecture

This change improves the overall performance and reliability of the SahiDawa system by providing automated precaching and a more robust ServiceWorker configuration. It also unlocks future development opportunities, such as easier integration with other Next.js features and improved support for offline capabilities.

## Testing & Verification

The change was tested by verifying that the custom event listeners and cache logic continue to function as expected, and that the ServiceWorker configuration is correctly generated and updated. Edge cases, such as offline mode and push notifications, were also tested to ensure that the new configuration does not introduce any regressions.