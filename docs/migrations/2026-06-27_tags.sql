-- ============================================================================
-- THE FRIEND ARCHIVE — Tags widening
--
-- Tags are stored in the existing media_items.genre column as a comma-separated
-- list (the column name is legacy; it holds the item's tag set: genres plus
-- enrichment/user tags like "anime", "rpg", "co-op"). This migration widens the
-- length cap from 100 to 255 chars so several tags fit, and adds a GIN index so
-- tag filtering stays fast as a group grows.
--
-- Additive and safe to run once on an existing database. No data is changed.
-- Run the whole block in the Supabase SQL Editor.
-- ============================================================================

-- 1. Widen the length check (was BETWEEN ... <= 100).
ALTER TABLE public.media_items DROP CONSTRAINT IF EXISTS genre_length;
ALTER TABLE public.media_items
  ADD CONSTRAINT genre_length CHECK (genre IS NULL OR char_length(genre) <= 255);

COMMENT ON COLUMN public.media_items.genre IS
  'Comma-separated tag list (genres + enrichment/user tags, e.g. "Action, Anime, Co-op"). Max 255 chars. Legacy column name; semantically the item tag set.';

-- 2. Trigram index for fast substring/tag matching (optional but recommended).
--    pg_trgm ships with Supabase; enabling it is idempotent.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_media_items_genre_trgm
  ON public.media_items USING gin (genre gin_trgm_ops);
