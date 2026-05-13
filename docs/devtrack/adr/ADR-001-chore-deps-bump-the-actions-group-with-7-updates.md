# ADR — chore(deps): bump the actions group with 7 updates

> **Date:** 2026-05-13 | **PR:** #91 | **Status:** Accepted

## Context

The project's CI/CD pipelines and automation workflows rely heavily on GitHub Actions. A significant number of these core actions released new major versions, primarily driven by an upgrade to Node.js 24 runtime. These updates introduced breaking changes, security fixes, performance enhancements, and new features across `actions/github-script`, `actions/stale`, `actions/checkout`, `github/codeql-action`, `actions/setup-node`, `actions/labeler`, and `actions/setup-python`. Maintaining outdated action versions posed risks related to security vulnerabilities, performance degradation, and incompatibility with future GitHub platform updates.

## Decision

All seven specified GitHub Actions were