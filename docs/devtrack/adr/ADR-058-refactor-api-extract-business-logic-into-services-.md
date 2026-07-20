# ADR — refactor(api): extract business logic into services and repositories

> **Date:** 2026-07-20 | **PR:** #3761 | **Status:** Accepted

## Context

The SahiDawa API route handlers (`pharmacies.ts` and `scan.ts`) previously contained mixed concerns, combining HTTP request/response handling, business logic, direct database queries (via the Supabase client), and caching operations (via Redis) in single files. This tight coupling resulted in several architectural challenges:
- **Poor Testability:** Unit testing business logic required mocking HTTP request/response objects or running integration-level tests.
- **Low Reusability:** Database queries and business rules could not be easily reused in other parts of the application, such as background workers, cron jobs, or CLI tools.
- **High Maintenance Overhead:** Changes to the database schema or Supabase client API required modifying the route handlers directly, increasing the risk of breaking HTTP interfaces.

## Decision

We refactored the API layer to implement a clean, layered architecture by separating concerns into three distinct layers:

1. **Controller/Route Layer (`routes/`):** Simplified route handlers to focus solely on HTTP concerns (parsing request parameters, validating payloads, and returning HTTP responses).
2. **Service Layer (`services/`):** Created `pharmacy.service.ts` and `scan.service.ts` to encapsulate core business logic, orchestration, and domain rules.
3. **Repository Layer (`repositories/`):** Created `pharmacy.repository.ts`, `scan.repository.ts`, and `redis.repository.ts` to abstract all data access logic. This layer directly interacts with the Supabase client (including RPC functions like `get_nearest_pharmacies` and `get_pharmacies_in_bounds`) and the Redis client.

Existing API behavior and contracts were preserved without introducing functional changes.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Active Record Pattern (via Prisma/TypeORM)** | Rejected because SahiDawa relies heavily on Supabase's client-side JS SDK and custom PostgreSQL RPC functions for spatial queries. Introducing a heavy ORM would add unnecessary complexity and overhead without providing significant benefits over the native Supabase client. |
| **Inline Helper Functions** | Keeping database queries in the route files but extracting them into local helper functions was rejected because it does not solve the separation of concerns. Route files would remain bloated, and data access logic would remain coupled to the HTTP context, preventing reuse. |

## Consequences

**Positive:**
- **Separation of Concerns:** Clear boundaries between transport (HTTP), business logic (Services), and data access (Repositories).
- **Improved Testability:** Services and repositories can now be unit-tested in isolation using standard mocking libraries without simulating HTTP lifecycles.
- **Centralized Data Access:** Database queries and RPC calls are consolidated, making schema migrations and query optimizations easier to manage.
- **Robust Error Handling:** Redis operations are safely wrapped inside the repository layer, preventing cache connection failures from crashing application routes.

**Trade-offs:**
- **Increased Boilerplate:** Simple CRUD operations now require touching multiple files (Route -> Service -> Repository) instead of a single route file.
- **Cognitive Load:** Developers must navigate a more deeply nested directory structure to trace execution flows.

## Related Issues & PRs

- PR #3761: refactor(api): extract business logic into services and repositories
- Issue #3681