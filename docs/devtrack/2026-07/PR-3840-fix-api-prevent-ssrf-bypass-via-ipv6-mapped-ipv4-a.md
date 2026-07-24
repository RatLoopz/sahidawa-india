# PR #3840 — fix(api): prevent SSRF bypass via IPv6-mapped IPv4 addresses (#3829)

> **Merged:** 2026-07-24 | **Author:** @Neverask1121 | **Area:** Backend | **Impact Score:** 6 | **Closes:** #3829

## What Changed

This PR introduces a critical security fix to prevent Server-Side Request Forgery (SSRF) bypass via IPv6-mapped IPv4 addresses. Specifically, it enhances the `isAllowedHostname` function in `apps/api/src/config/mlService.ts` to detect and reject IPv6-mapped loopback and private IPv4 addresses. The change ensures that our system's validation rules are applied consistently across different address types, thereby preventing potential SSRF vulnerabilities.

## The Problem Being Solved

Before this PR, our system was vulnerable to SSRF attacks because it did not properly handle IPv6-mapped IPv4 addresses. An attacker could bypass the existing hostname validation by using an IPv6-mapped address, such as `::ffff:127.0.0.1` or `::ffff:10.0.0.1`, to access internal or private resources. This oversight posed a significant security risk, as it could allow unauthorized access to sensitive data or systems.

## Files Modified

- `apps/api/src/config/mlService.ts`

## Implementation Details

The implementation involves two key changes:
1. **Extracting Embedded IPv4 Addresses**: A new function, `getMappedIpv4`, is introduced to extract the embedded IPv4 address from an IPv6-mapped IPv4 address. This function uses a regular expression to match the IPv6-mapped address pattern and returns the extracted IPv4 address.
2. **Enhanced Hostname Validation**: The `isAllowedHostname` function is updated to utilize the `getMappedIpv4` function. If an IPv6-mapped IPv4 address is detected, the function extracts the embedded IPv4 address and applies the existing validation rules to the normalized hostname. This ensures that the validation logic is consistently applied across different address types.

## Technical Decisions

The decision to use a regular expression to extract the embedded IPv4 address was driven by the need for a concise and efficient solution. The regular expression pattern `^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i` effectively matches the IPv6-mapped address format and captures the embedded IPv4 address. This approach allows for a simple and maintainable implementation.

## How To Re-Implement (Contributor Reference)

To re-implement this feature, follow these steps:
1. Create a new function, `getMappedIpv4`, to extract the embedded IPv4 address from an IPv6-mapped IPv4 address. Use a regular expression to match the IPv6-mapped address pattern.
2. Update the `isAllowedHostname` function to utilize the `getMappedIpv4` function. If an IPv6-mapped IPv4 address is detected, extract the embedded IPv4 address and apply the existing validation rules to the normalized hostname.
3. Ensure that the updated `isAllowedHostname` function is used consistently throughout the system to validate hostnames.

## Impact on System Architecture

This change enhances the security posture of the SahiDawa system by preventing SSRF attacks via IPv6-mapped IPv4 addresses. The updated validation logic ensures that the system consistently applies security rules across different address types, reducing the risk of unauthorized access to sensitive data or systems. This fix also demonstrates the system's commitment to security and robustness, which is essential for maintaining trust and reliability in the platform.

## Testing & Verification

The change was tested by verifying that:
* Valid external HTTP/HTTPS URLs continue to pass validation.
* IPv6-mapped IPv4 loopback and private addresses are rejected by the updated hostname validation logic.
These tests ensure that the updated validation logic is effective in preventing SSRF attacks while allowing legitimate traffic to pass through.