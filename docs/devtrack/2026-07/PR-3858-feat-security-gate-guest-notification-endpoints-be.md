# PR #3858 — feat(security): gate guest notification endpoints behind a proof-of-ownership token (Closes #3836)

> **Merged:** 2026-07-24 | **Author:** @shashank03-dev | **Area:** Frontend | **Impact Score:** 39 | **Closes:** #3836

## What Changed

This PR introduces a proof-of-ownership token for guest notification endpoints, ensuring that only authorized guests can access and modify their own subscription settings. The token is minted when a guest verifies their phone number via OTP and is used to authenticate subsequent requests to the `/status`, `PATCH /phone`, and `DELETE /phone` endpoints. This change enhances the security of the SahiDawa platform by preventing unauthorized access to guest subscription settings.

## The Problem Being Solved

Before this PR, the guest subscription management system was vulnerable to unauthorized access, as anyone could read, change, or delete another person's alert settings by knowing their phone number. This lack of authentication and authorization posed a significant security risk, as malicious actors could exploit this vulnerability to compromise the privacy and security of SahiDawa users.

## Files Modified

- `apps/api/package.json`
- `apps/api/src/routes/notifications.ts`
- `apps/api/src/utils/guestToken.ts`
- `apps/api/tests/guestToken.test.ts`
- `apps/api/tests/notifications.test.ts`
- `apps/web/app/[locale]/settings/page.tsx`
- `apps/web/lib/api/notifications.ts`
- `apps/web/messages/en.json`
- `apps/web/tests/Settings-page.test.tsx`
- `package-lock.json`

## Implementation Details

The implementation of the proof-of-ownership token involves the following key components:

*   The `guestToken.ts` utility file, which provides functions for signing and verifying guest tokens using the `jsonwebtoken` library.
*   The `notifications.ts` file, which has been updated to use the `getGuestToken` function to extract the guest token from the `X-Guest-Token` header and verify it using the `verifyGuestPhone` function.
*   The `verify-otp` endpoint, which now mints a short-lived guest token when a guest verifies their phone number via OTP.
*   The `/status`, `PATCH /phone`, and `DELETE /phone` endpoints, which now require a valid guest token to be present in the `X-Guest-Token` header.

The `signGuestToken` function uses the `HS256` algorithm to sign a JSON Web Token (JWT) containing the guest's phone number, while the `verifyGuestPhone` function verifies the token by checking its signature and ensuring that it has not expired.

## Technical Decisions

The decision to use JSON Web Tokens (JWTs) for guest token implementation was driven by the need for a secure and standardized token format. The `HS256` algorithm was chosen for its widespread adoption and security properties. The `jsonwebtoken` library was selected for its ease of use and flexibility in generating and verifying JWTs.

## How To Re-Implement (Contributor Reference)

To re-implement this feature, follow these steps:

1.  Install the required dependencies, including `jsonwebtoken` and `@types/jsonwebtoken`.
2.  Create a `guestToken.ts` utility file to handle token signing and verification.
3.  Update the `notifications.ts` file to use the `getGuestToken` function to extract and verify the guest token.
4.  Modify the `verify-otp` endpoint to mint a short-lived guest token when a guest verifies their phone number via OTP.
5.  Update the `/status`, `PATCH /phone`, and `DELETE /phone` endpoints to require a valid guest token in the `X-Guest-Token` header.

## Impact on System Architecture

This change enhances the security and authentication of the SahiDawa platform, ensuring that only authorized guests can access and modify their own subscription settings. The introduction of proof-of-ownership tokens provides an additional layer of protection against unauthorized access, improving the overall security posture of the system.

## Testing & Verification

The implementation includes a comprehensive set of tests to verify the correctness and security of the proof-of-ownership token system. These tests cover various scenarios, including:

*   Token generation and verification
*   Endpoint authentication and authorization
*   Error handling and edge cases

The tests are written using Jest and are located in the `apps/api/tests` directory. They provide a high degree of confidence in the correctness and security of the implementation.