# ADR — feat(admin): add OCR verification approval queue dashboard (#2944)

> **Date:** 2026-07-04 | **PR:** #2944 | **Status:** Accepted

## Context

SahiDawa processes medicine images uploaded from rural areas using Optical Character Recognition (OCR) to extract critical drug metadata. However, raw OCR outputs are prone to transcription errors due to poor image quality, low lighting, or complex packaging layouts. Because incorrect medicine data poses severe patient safety risks, SahiDawa cannot rely solely on automated ingestion. 

Prior to this decision, there was no structured mechanism or administrative interface to queue, review, and audit OCR-extracted medicine data against the original uploaded images before marking them as verified in the system.

## Decision

We implemented a Human-in-the-Loop (HITL) verification workflow consisting of a dedicated database schema, backend API endpoints, and an administrative dashboard. 

Specifically, we:
1. **Created a dedicated schema** via Supabase migration (`medicine_verification_requests`) to decouple raw OCR submissions and verification metadata from the core `medicines` table.
2. **Built paginated backend endpoints** in `admin.controller.ts` using Express and TypeScript, leveraging Zod schemas (`verificationReviewSchema`) for strict input validation.
3. **Implemented state transition logic** where approving a request updates the request status to `approved`, logs the moderator's ID (`reviewed_by`) and timestamp (`reviewed_at`), and atomically updates the target medicine's status (`is_verified: true`) in the `medicines` table.
4. **Added auditability** by capturing rejection reasons (`rejection_reason`) up to 500 characters for rejected submissions.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Fully Automated OCR Auto-Approval** (using confidence score thresholds) | Rejected due to safety concerns. Even high-confidence OCR can misread look-alike sound-alike (LASA) drug names, which is unacceptable for a medical verification platform. |
| **Direct Inline Flagging on the `medicines` Table** (without a separate request table) | Rejected because it lacks audit trails. It would mix transient verification state (raw OCR text, rejection reasons, moderator IDs) with the clean, production-ready medicine catalog. |

## Consequences

**Positive:**
- **Data Integrity:** Ensures all public-facing medicine listings are manually verified against physical packaging images, eliminating OCR hallucinations.
- **Audit Trail:** Provides full accountability by tracking which administrator approved or rejected each verification request.
- **Separation of Concerns:** Keeps the core `medicines` table clean and optimized, containing only verified or explicitly pending records without transient review metadata.

**Trade-offs:**
- **Operational Bottleneck:** Introduces human latency into the medicine ingestion pipeline, requiring active moderator participation to clear the queue.
- **Write Amplification:** Approving a request requires two separate database writes (updating the `medicine_verification_requests` table and the `medicines` table).

## Related Issues & PRs

- PR #2944: feat(admin): add OCR verification approval queue dashboard
- Issue #2944