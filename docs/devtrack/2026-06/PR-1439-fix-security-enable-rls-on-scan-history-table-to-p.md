# PR #1439 — fix(security): enable RLS on scan_history table to prevent public manipulation (#1401)

> **Merged:** 2026-06-07 | **Author:** @shauryavardhan1307 | **Area:** Database | **Impact Score:** 10 | **Closes:** #1401

## What Changed

We have implemented Row Level Security (RLS) on the `public.scan_history` table within our Supabase PostgreSQL database. This change introduces a new policy, `scan_history_service_only`, which restricts all database operations (SELECT, INSERT, UPDATE, DELETE) on this table exclusively to the `service_role` key. Consequently, any requests made using the `anon` key or other non-administrative roles will be blocked from interacting with the `scan_history` table.

## The Problem Being Solved

Prior to this PR, the `public.scan_history` table, which tracks duplicate scan anomaly detection and other sensitive telemetry, was publicly accessible to anyone possessing the Supabase `anon` key. This posed a significant security vulnerability, as unauthorized clients could potentially read, modify, or delete critical scan logs. Such manipulation could compromise the integrity of our anomaly detection system, lead to incorrect health insights, or allow malicious actors to obscure their activities. The absence of RLS meant there was no fine-grained control over who could access this sensitive data at the database level.

## Files Modified

- `supabase/migrations/20260607000000_add_rls_scan_history.sql`

## Implementation Details

This change was implemented via a new database migration file, `supabase/migrations/20260607000000_add_rls_scan_history.sql`. This SQL script performs two primary actions:

1.  **Enabling RLS:** The `ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;` statement activates Row Level Security for the `scan_history` table. Once RLS is enabled, any role attempting to access the table will be subject to defined policies, and if no policies grant access, the access will be denied by default.
2.  **Creating a Policy:** A new policy named `scan_history_service_only` is created using the `CREATE POLICY` statement.
    - `ON public.scan_history`: Specifies that this policy applies to the `scan_history` table.
    - `FOR ALL`: This clause indicates that the policy applies to all types of operations: `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
    - `TO service_role`: This is the crucial part that restricts access. The policy grants permissions exclusively to the `service_role`. In our Supabase setup, the `service_role` is an administrative role typically used by our backend services (e.g., the Express API) via the `service_key`, which has elevated privileges and bypasses RLS by default unless explicitly targeted by a policy. Here, we are explicitly granting it access _through_ the policy.
    - `USING (true) WITH CHECK (true)`: These conditions ensure that the policy is always true for the `service_role`. `USING (true)` applies to `SELECT` and `DELETE` operations, while `WITH CHECK (true)` applies to `INSERT` and `UPDATE` operations. By setting both to `true`, we effectively grant the `service_role` full, unrestricted access to the table, while all other roles (like `anon`) will be denied access by default due to the enabled RLS and the lack of other policies granting them permission.

This setup ensures that only our trusted backend services, operating with the `service_role` key, can interact with the `scan_history` table, thereby preventing direct client-side manipulation or unauthorized data access.

## Technical Decisions

We chose to implement Row Level Security directly at the database level for several key reasons:

1.  **Principle of Least Privilege:** RLS enforces security closest to the data, ensuring that even if an application layer vulnerability were to exist, unauthorized database access would still be prevented. This is a fundamental security best practice.
2.  **Supabase Integration:** Supabase provides robust RLS capabilities built on PostgreSQL, making it a natural and efficient choice for securing our database tables. It integrates seamlessly with our existing Supabase backend.
3.  **Centralized Control:** By restricting `scan_history` operations to the `service_role`, we centralize control over this sensitive data within our trusted backend API. This prevents any direct client-side interaction with the telemetry data, ensuring that all modifications and reads are mediated and validated by our server-side logic.
4.  **Simplicity and Robustness:** For a table like `scan_history` where direct client access is never intended, a blanket restriction to the `service_role` using `FOR ALL TO service_role USING (true) WITH CHECK (true)` is both simple to implement and highly robust. It avoids the complexity of more granular, user-specific RLS policies that would be required for user-facing data.

Alternatives considered included implementing application-level security checks within our backend API. While application-level security is also crucial, it acts as a secondary layer. Database-level RLS provides a foundational security layer that protects the data even if the application layer is bypassed or compromised, offering a stronger defense-in-depth strategy.

## How To Re-Implement (Contributor Reference)

To re-implement or apply similar RLS policies for other tables, a contributor would follow these steps:

1.  **Identify the Target Table and Access Requirements:** Determine which table needs RLS and what roles should have what level of access (e.g., `anon`, `authenticated`, `service_role`, specific user IDs). For `scan_history`, the requirement was full restriction to `service_role`.
2.  **Create a New Migration File:** Generate a new SQL migration file in the `supabase/migrations/` directory. The naming convention typically follows `YYYYMMDDHHMMSS_description.sql`. For example, `20260607000000_add_rls_scan_history.sql`.
3.  **Enable RLS on the Table:** Add the `ALTER TABLE` statement to enable RLS for the target table:
    ```sql
    ALTER TABLE public.<your_table_name> ENABLE ROW LEVEL SECURITY;
    ```
4.  **Define the Policy:** Create one or more `CREATE POLICY` statements to define the access rules.
    - **For full access to `service_role` (as done here):**
        ```sql
        CREATE POLICY "<policy_name>"
          ON public.<your_table_name>
          FOR ALL
          TO service_role
          USING (true)
          WITH CHECK (true);
        ```
        Replace `<policy_name>` with a descriptive name (e.g., `my_table_service_only`) and `<your_table_name>` with the actual table name. `FOR ALL` covers `SELECT`, `INSERT`, `UPDATE`, `DELETE`. `TO service_role` grants access to the administrative role. `USING (true) WITH CHECK (true)` ensures the policy always applies without further conditions.
    - **For more granular policies (e.g., users can only see their own data):**
        ```sql
        CREATE POLICY "users_can_view_their_own_data"
          ON public.<your_table_name>
          FOR SELECT
          TO authenticated
          USING (auth.uid() = user_id); -- Assuming a 'user_id' column
        ```
        This example allows authenticated users to `SELECT` rows where their `auth.uid()` matches the `user_id` column in the table.
5.  **Test the Policy:** After applying the migration (e.g., by running `supabase db reset` in a local development environment or deploying), thoroughly test the RLS:
    - Attempt operations with the `anon` key (should fail for restricted tables).
    - Attempt operations with the `service_role` key (should succeed for tables where it's granted access).
    - Attempt operations with `authenticated` user keys, verifying they only access data permitted by their specific policies.
6.  **Review and Commit:** Ensure the migration file is clean, well-commented (like the example in this PR), and committed.

## Impact on System Architecture

This change significantly strengthens the security posture of the SahiDawa platform's database layer. By enabling RLS on `scan_history`, we have:

1.  **Enhanced Data Integrity:** We now have a robust, database-level guarantee that `scan_history` data, crucial for our anomaly detection and platform analytics, cannot be tampered with or accessed by unauthorized clients.
2.  **Reinforced Security Model:** This move reinforces our security model by pushing access control closer to the data, adhering to the principle of least privilege. It means that even if our frontend or a client application were compromised, direct database manipulation of `scan_history` would still be prevented.
3.  **Clearer API Responsibility:** The `service_role` (and thus our backend API) is now the sole, authoritative gateway for all interactions with `scan_history`. This clarifies the responsibility of the backend to mediate, validate, and log all operations, ensuring consistency and auditability.
4.  **Foundation for Future Security:** This implementation serves as a clear example and pattern for applying RLS to other sensitive tables as our platform evolves, making it easier to secure new data models consistently.

This change does not introduce new external dependencies or alter the core data flow for legitimate backend operations. Instead, it adds a critical security enforcement layer that protects existing data flows from illegitimate access.

## Testing & Verification

The primary verification for this change was conducted through our standard migration checker and, implicitly, through functional testing of the RLS policy.

1.  **Migration Checker Execution:** The "Pre-Deployment Migration Checker Execution" log provided in the PR proof of work confirms that the `supabase/migrations/20260607000000_add_rls_scan_history.sql` file was successfully parsed and recognized as a valid migration. This ensures the SQL commands are syntactically correct and will be applied to the database schema.
2.  **Functional RLS Testing (Implicit):** While explicit logs of `anon` key vs. `service_role` key access attempts are not included in the PR description, the "Proof of Work" section and the checklist item "No Pull Request will be merged without proof of testing!" indicate that functional testing was performed. This would typically involve:
    - Attempting `SELECT`, `INSERT`, `UPDATE`, and `DELETE` operations on `public.scan_history` using a Supabase client configured with the `anon` key. All these operations are expected to fail with a permission denied error.
    - Attempting the same operations using a Supabase client configured with the `service_role` key. All these operations are expected to succeed, confirming that the backend retains necessary access.

Edge cases for RLS typically involve complex policy interactions or misconfigurations. However, for this specific policy, which is a straightforward blanket restriction to `service_role`, the primary edge case would be if the `service_role` itself were somehow compromised or if the backend application failed to use the `service_key` correctly. These are addressed by broader system security practices and backend configuration, not by the RLS policy itself. The policy's simplicity makes it less prone to subtle logical errors.
