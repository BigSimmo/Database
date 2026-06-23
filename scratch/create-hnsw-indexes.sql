-- SQL script to recreate the missing HNSW vector indexes.
-- Run this script in the Supabase Dashboard SQL Editor for your project:
-- https://supabase.com/dashboard/project/sjrfecxgysukkwxsowpy/sql/new

SET statement_timeout = 0; -- disable statement timeout for index creation

-- 1. Create HNSW index on document_chunks (69,000+ rows)
-- This is a large build and must be run without session timeout.
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
  ON public.document_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 24, ef_construction = 128);

-- 2. Create HNSW index on document_memory_cards (10,000+ rows)
CREATE INDEX IF NOT EXISTS document_memory_cards_embedding_hnsw_idx
  ON public.document_memory_cards USING hnsw (embedding vector_cosine_ops)
  WITH (m = 24, ef_construction = 128);

-- 3. Create HNSW index on document_embedding_fields (3,000+ rows)
CREATE INDEX IF NOT EXISTS document_embedding_fields_embedding_hnsw_idx
  ON public.document_embedding_fields USING hnsw (embedding vector_cosine_ops)
  WITH (m = 24, ef_construction = 128);
