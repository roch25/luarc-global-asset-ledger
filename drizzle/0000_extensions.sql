-- Trigram indexes power substring search (ILIKE '%term%') over millions of asset names/symbols.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
