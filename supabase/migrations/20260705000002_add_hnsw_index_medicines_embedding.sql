-- =============================================================================
-- SahiDawa — Add HNSW vector index on medicines.embedding for RAG optimization
-- =============================================================================
-- Adds an HNSW index on medicines.embedding (vector(768)) to accelerate
-- approximate nearest-neighbour searches in the match_medicines() RPC function.
--
-- HNSW provides O(log n) query time with high recall at production scale.
-- The vector_cosine_ops operator class matches the <=> operator used in
-- match_medicines() so no changes to the retrieval function are needed.
-- =============================================================================

CREATE INDEX IF NOT EXISTS medicines_embedding_idx
  ON public.medicines
  USING hnsw (embedding vector_cosine_ops);