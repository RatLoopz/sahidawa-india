# PR #2998 — Feat/langgraph rag retrieval clean

> **Merged:** 2026-07-04 | **Author:** @arushiranjan | **Area:** ML/AI | **Impact Score:** 42 | **Closes:** #2660

## What Changed

We integrated our existing PostgreSQL `pgvector` medicine retrieval pipeline directly into the LangGraph-powered Health Assistant triage workflow. This was achieved by introducing a new retrieval node that generates query embeddings using the Gemini embedding API and queries our database via a Supabase RPC. The retrieved medicine context is then formatted and injected into the final synthesis prompt to ground the LLM's recommendations in verified Indian medicines.

## The Problem Being Solved

Before this PR, the LangGraph Health Assistant operated in isolation from our verified medicine database. While it could perform symptom triage and collect clinical details, it could not ground its recommendations in actual, verified medicines stored in our database. 

Furthermore, we lacked a clean, unified way to generate query embeddings and execute vector similarity searches within our Python-based ML service, as the existing `match_medicines` database function was primarily consumed by our TypeScript backend. 

Additionally, a duplicate migration timestamp (`20260627000000`) was blocking local database migrations, preventing contributors from setting up their environments cleanly.

## Files Modified

- `apps/ml/requirements.txt`
- `apps/ml/services/embedding.py`
- `apps/ml/services/retrieval.py`
- `apps/ml/services/triage_graph.py`
- `supabase/migrations/20260627000001_fix_district_alerts_uniqueness.sql`

## Implementation Details

### 1. Embedding Generation (`apps/ml/services/embedding.py`)
We implemented a lightweight embedding generator `embed_query(text: str) -> Optional[list[float]]` that interacts directly with the Gemini REST API. 
- **Model Used:** `gemini-embedding-2`
- **Dimensions:** 768
- **Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent`
- **Implementation:** It uses the standard `requests` library to send a POST request containing the user query. The function validates that the returned vector is a list of exactly 768 floats before returning it, handling network exceptions and non-200 status codes gracefully.

### 2. Medicine Retrieval (`apps/ml/services/retrieval.py`)
We created `retrieve_relevant_medicines(query: str, limit: int = 5) -> list[dict[str, Any]]` to bridge our ML service with our Supabase database.
- It generates an embedding of the query using `embed_query`.
- It executes a POST request to our Supabase PostgREST RPC endpoint `/rest/v1/rpc/match_medicines`.
- It passes the embedding and the limit (`match_count`) in the payload, reusing the exact same database function used by our TypeScript backend.

### 3. LangGraph Workflow Integration (`apps/ml/services/triage_graph.py`)
We updated our state machine and nodes to support Retrieval-Augmented Generation (RAG):
- **State Extension:** Added `retrieved_medicines: List[Dict[str, Any]]` to the `TriageState` TypedDict to carry retrieved context across nodes.
- **Model Update:** Standardized `get_llm()` to use `gemini-2.5-flash` (updating from the placeholder `gemini-3.5-flash`) and switched the environment variable key to `GEMINI_API_KEY` for consistency across our ML services.
- **Retrieval Node (`retrieval_node`):** Extracts structured clinical details (`location`, `severity`, `onset`, `associated_symptoms`) from `state["collected_info"]` to construct a rich, search-optimized query. If no structured info is available, it falls back to the raw user query. It calls `retrieve_relevant_medicines` and saves the results to the state.
- **Context Formatting (`format_medicine_context`):** Converts the list of retrieved medicines into a clean, structured text block containing Brand Name, Generic Name, Composition, and Manufacturer.
- **Final Synthesis Node (`final_synthesis_node`):** Injects the formatted medicine context into the system prompt. The prompt strictly instructs the LLM to treat this as supporting clinical context, forbid the hallucination of medicine names, and only mention medicines present in the retrieved context.

### 4. Migration Ordering Fix
We renamed `20260627000000_fix_district_alerts_uniqueness.sql` to `20260627000001_fix_district_alerts_uniqueness.sql`. This resolves a duplicate timestamp conflict in our Supabase migrations, allowing local environments to apply migrations sequentially without errors.

## Technical Decisions

- **Direct REST Calls over Heavy SDKs:** In `embedding.py` and `retrieval.py`, we chose to use the standard `requests` library to interact with Gemini and Supabase PostgREST instead of pulling in the full Google Generative AI or Supabase Python SDKs. This keeps our ML service lightweight, reduces container image sizes, and minimizes dependency resolution issues.
- **Structured Query Construction:** Rather than embedding the raw, noisy last message from the user, the `retrieval_node` constructs a query by concatenating structured clinical details extracted by previous triage nodes. This significantly improves vector search relevance by focusing on clinical symptoms rather than conversational filler.
- **Strict Prompt Grounding for Safety:** To prevent the LLM from recommending incorrect or hallucinated drugs, we implemented strict system instructions. The LLM is prohibited from inventing medicine names or recommending any drugs not explicitly provided in the retrieved context.

## How To Re-Implement (Contributor Reference)

If you need to re-implement or extend this RAG pipeline, follow these steps:

1. **Dependencies:** Ensure `supabase>=2.5.0`, `dotenv`, and `requests` are present in your environment or `requirements.txt`.
2. **Environment Variables:** Configure your `.env` file with:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
3. **Embedding Generation:** Implement a POST request to the Gemini embedding endpoint. Ensure you enforce the 768-dimension check to match our database's `vector(768)` column configuration.
4. **Database RPC Call:** Call the `/rest/v1/rpc/match_medicines` endpoint. The payload must match:
   ```json
   {
     "query_embedding": [0.123, ...],
     "match_count": 5
   }
   ```
5. **State Registration:** Add `retrieved_medicines` to your LangGraph `State` definition.
6. **Node Insertion:** Insert the `retrieval_node` into your LangGraph compilation flow. It must run *after* the symptom collection/triage nodes (so `collected_info` is populated) and *before* the `final_synthesis_node`.
7. **Prompt Guardrails:** When writing the prompt for the synthesis node, always include explicit instructions to prevent the LLM from recommending medicines outside the provided context.

## Impact on System Architecture

This change bridges the gap between our unstructured conversational AI (LangGraph) and our structured relational data (PostgreSQL/pgvector). It establishes a reusable pattern for Retrieval-Augmented Generation (RAG) within our Python ML services, allowing us to easily ground other conversational workflows in our database entities. Furthermore, resolving the migration conflict ensures clean, automated CI/CD runs and a frictionless setup experience for new open-source contributors.

## Testing & Verification

We verified this implementation using the following checks:
- **Retrieval Node Execution:** Verified via logs that the `retrieval_node` successfully extracts structured symptoms (e.g., `head mild yesterday fever`) and executes the vector search.
- **Graceful Fallbacks:** Verified that when the database returns no matching medicines (`[]`), the system successfully falls back to `"No medicine context available."` and the LLM synthesizes a safe, non-pharmaceutical triage response without hallucinating drugs.
- **Migration Verification:** Ran local migrations successfully using the renamed timestamp file, confirming that duplicate migration conflicts are resolved.