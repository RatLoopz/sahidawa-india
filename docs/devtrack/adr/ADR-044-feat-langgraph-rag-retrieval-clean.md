# ADR — Feat/langgraph rag retrieval clean

> **Date:** 2026-07-04 | **PR:** #2998 | **Status:** Accepted

## Context

The LangGraph-based Health Assistant in the ML service required access to verified medicine data to ground its triage and synthesis outputs. While the platform already utilized a PostgreSQL database with `pgvector` and a custom database function (`match_medicines`) for semantic search, this pipeline was not integrated into the ML service's agentic workflow. To prevent hallucinations and provide accurate, localized medicine recommendations, the LangGraph workflow needed a structured Retrieval-Augmented Generation (RAG) pipeline to fetch context before final synthesis.

Additionally, duplicate migration timestamps (`20260627000000`) blocked local database migrations, requiring a cleanup of the migration sequence.

## Decision

We integrated the existing `pgvector` medicine retrieval pipeline directly into the LangGraph triage workflow. 

Specifically, we:
1. **Created an Embedding Service:** Implemented a lightweight client in `apps/ml/services/embedding.py` to generate 768-dimensional query embeddings using the Gemini REST API (`gemini-embedding-2`).
2. **Created a Retrieval Service:** Implemented `apps/ml/services/retrieval.py` to invoke the existing `match_medicines` PostgreSQL RPC via Supabase's PostgREST interface, reusing the database infrastructure already established for the TypeScript backend.
3. **Modified the LangGraph Workflow:** Added a retrieval node in `apps/ml/services/triage_graph.py` that executes after query structuring and before the final synthesis node. The retrieved medicine context is injected into the synthesis prompt, with graceful fallback handling if no medicines are returned.
4. **Resolved Migration Conflicts:** Renamed the duplicate migration file to `20260627000001_fix_district_alerts_uniqueness.sql` to restore sequential execution.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Route retrieval through the TypeScript backend API** | Adds unnecessary network hops and latency to the triage loop. It also introduces a tight coupling between the ML service and the Node.js/TypeScript application layer. |
| **Deploy a dedicated vector database (e.g., Pinecone or Qdrant)** | Increases operational complexity, infrastructure costs, and data synchronization overhead. Reusing the existing Supabase `pgvector` setup keeps the architecture simple and cost-effective. |

## Consequences

**Positive:**
- **Data Consistency:** Reuses the exact same database schema and semantic search logic (`match_medicines`) used by other platform services, ensuring consistent search results.
- **Improved Triage Accuracy:** Grounding the LangGraph synthesis node in verified medicine data reduces LLM hallucinations.
- **Decoupled Execution:** The ML service interacts directly with the database layer via PostgREST, avoiding dependencies on the primary application server.

**Trade-offs:**
- **Latency Overhead:** The triage workflow now incurs two sequential external HTTP requests (one to Gemini for embedding generation, and one to Supabase for vector similarity search) before synthesis can begin.
- **Direct DB Dependency:** The ML service now requires direct access to Supabase environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`), increasing the secret management footprint for the ML container.

## Related Issues & PRs

- PR #2998: Feat/langgraph rag retrieval clean
- Issue #2660