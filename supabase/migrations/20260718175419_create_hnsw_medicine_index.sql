-- Drop the existing default HNSW index to replace it with a tuned one
DROP INDEX IF EXISTS medicines_embedding_idx;

-- Create an HNSW index on the vector embedding column of the medicines table 
-- with tuned parameters (m = 16, ef_construction = 64) to optimize cosine similarity searches
CREATE INDEX IF NOT EXISTS medicines_embedding_hnsw_idx 
ON medicines USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);
