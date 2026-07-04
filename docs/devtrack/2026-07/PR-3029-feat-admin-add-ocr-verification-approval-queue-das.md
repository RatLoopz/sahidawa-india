# PR #3029 — feat(admin): add OCR verification approval queue dashboard (#2944)

> **Merged:** 2026-07-04 | **Author:** @Khanvilkarshravani27 | **Area:** Frontend | **Impact Score:** 45 | **Closes:** #2944

## What Changed

We introduced a complete administrative moderation workflow for OCR-extracted medicine image verifications. This implementation spans the entire stack: a new database migration creating the `medicine_verification_requests` table, backend API endpoints to fetch and review pending requests, and a highly interactive React dashboard page (`/admin/approval`) built with Tailwind CSS and Lucide icons. This dashboard allows administrators to perform side-by-side comparisons of uploaded medicine packaging images against OCR-extracted text before manually approving or rejecting them.

## The Problem Being Solved

Prior to this PR, our system lacked a human-in-the-loop (HITL) verification mechanism for OCR-extracted medicine data. When users uploaded medicine packaging images in rural clinics, the OCR engine processed the text, but there was no administrative interface to audit the accuracy of the extraction against the physical image. This created a high risk of OCR hallucinations, misread dosages, or incorrect brand names entering our verified medicine database. We needed a secure, multi-tiered moderation queue to ensure that only 100% accurate, human-verified medicine data is published to our platform.

## Files Modified

- `apps/api/src/controllers/admin.controller.ts`
- `apps/api/src/routes/admin.routes.ts`
- `apps/web/app/[locale]/admin/approval/page.tsx`
- `apps/web/app/[locale]/admin/dashboard/page.tsx`
- `apps/web/components/RequestVerificationModal.tsx`
- `supabase/migrations/20260703000000_create_medicine_verification_requests.sql`

## Implementation Details

### 1. Database Schema (`supabase/migrations/...`)
We created the `medicine_verification_requests` table to track the lifecycle of each verification request. The schema stores:
- `id`: Unique identifier (UUID).
- `medicine_id`: Foreign key referencing the `medicines` table (nullable if the medicine is entirely new).
- `medicine_name`: The name of the medicine as submitted.
- `image_url`: S3/Supabase storage link to the uploaded packaging image.
- `ocr_extracted_text`: Raw text extracted by our OCR engine.
- `ocr_raw_response`: JSONB field containing the complete structured payload from the OCR provider.
- `status`: Postgres enum (`pending`, `approved`, `rejected`).
- `submitted_by` / `reviewed_by`: Foreign keys to the users table.
- `rejection_reason`: Text field (max 500 characters) populated when a request is rejected.

### 2. Backend Controllers & Routes (`apps/api/src/...`)
We implemented two primary controller functions in `admin.controller.ts`:
- `getPendingVerificationRequests`: Fetches pending requests using Supabase pagination (`range(offset, offset + limit - 1)`). It performs an inner join on the `medicines` table to fetch metadata like `brand_name`, `generic_name`, and `manufacturer`.
- `reviewVerificationRequest`: Handles the approval/rejection state transition. It validates the request body using Zod (`verificationReviewSchema`). If a request is approved and contains a valid `medicine_id`, it automatically updates the corresponding record in the `medicines` table, setting `is_verified = true`. It also logs the administrative action using our internal `logAdminAction` utility for audit compliance.

We registered these controllers in `admin.routes.ts` with strict middleware chains:
- `GET /verifications`: Protected by `requireAuth` and `requireRole("admin", "moderator")`.
- `PATCH /verifications/:id/review`: Protected by `requireAuth` and `requireRole("admin")`.

### 3. Frontend Dashboard (`apps/web/app/...`)
We built a responsive, split-pane dashboard in `apps/web/app/[locale]/admin/approval/page.tsx`. 
- It utilizes React state hooks to manage active requests, loading states, and modal forms.
- It leverages `useSession` to retrieve the current user's JWT token and injects it into the `Authorization` header of all API calls.
- It implements client-side permission checks using `getAdminRoleFromSession` and `canMutateAdminData` to disable action buttons for users who only have read-only moderator access.

## Technical Decisions

- **Strict Role Separation:** We decided to allow both `admin` and `moderator` roles to view the queue (`GET /verifications`), but restricted the mutation endpoint (`PATCH /verifications/:id/review`) strictly to the `admin` role. This ensures that while moderators can triage and inspect requests, only high-level administrators can commit changes to the verified medicine catalog.
- **Zod Schema Validation:** We enforced strict payload validation on the backend using Zod. The `verificationReviewSchema` ensures that any rejection payload contains a valid string format and limits the `rejection_reason` to 500 characters to prevent database bloat or malicious payload injections.
- **Audit Logging:** We integrated `logAdminAction` directly into the review controller. This ensures that every single approval or rejection is permanently logged with the admin's user ID, target medicine ID, and status, providing an immutable audit trail for regulatory compliance.

## How To Re-Implement (Contributor Reference)

If you need to re-implement or extend this verification queue, follow these steps:

1. **Database Setup:**
   Ensure the `medicine_verification_requests` table is active. If writing a new migration, link it to the `medicines` table with an `ON DELETE SET NULL` clause to prevent orphaned requests if a medicine is deleted.

2. **Controller Logic:**
   In your controller, always validate the incoming request body using Zod:
   ```typescript
   const verificationReviewSchema = z.object({
       status: z.enum(["approved", "rejected"]),
       rejection_reason: z.string().max(500).optional(),
   });
   ```
   When a request is approved, perform a secondary database update on the `medicines` table:
   ```typescript
   await supabase.from("medicines").update({ is_verified: true }).eq("id", medicine_id);
   ```

3. **Route Protection:**
   Always chain the authentication and authorization middlewares in the router file:
   ```typescript
   router.patch("/verifications/:id/review", requireAuth, requireRole("admin"), reviewVerificationRequest);
   ```

4. **Frontend Integration:**
   When fetching data on the client side, retrieve the token from the session provider and pass it in the headers:
   ```typescript
   const res = await fetch(`${ADMIN_API_BASE}/verifications`, {
       headers: {
           Authorization: `Bearer ${token}`,
           "Content-Type": "application/json"
       }
   });
   ```
   Ensure you handle the `canMutate` flag to conditionally render or disable the "Approve" and "Reject" buttons based on the user's role.

## Impact on System Architecture

This change introduces a robust human-in-the-loop (HITL) layer to our data ingestion pipeline. By decoupling raw OCR ingestion from the verified medicine catalog, we protect downstream services (such as the mobile search API used by rural health workers) from displaying unverified or potentially dangerous drug information. It establishes a scalable pattern for future moderation queues, such as pharmacy registration approvals or user-reported data corrections.

## Testing & Verification

- **Manual Verification:** The interface was verified by uploading sample medicine packaging images, triggering OCR analysis, and verifying that the requests appeared in the `/admin/approval` queue.
- **Role-Based Access Testing:** We verified that accounts with the `moderator` role could view the queue but received a `403 Forbidden` error when attempting to approve or reject requests. Admin accounts were able to successfully approve requests, which instantly updated the `is_verified` flag to `true` in the `medicines` table.
- **Edge Cases Handled:**
  - If a verification request does not have an associated `medicine_id` (e.g., a request for a completely new medicine), the approval flow completes successfully without attempting to update the `medicines` table, preventing database foreign key crashes.
  - Rejection requests without a `rejection_reason` are blocked on the frontend, forcing admins to provide context for the rejection.