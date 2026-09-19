-- ============================================================
-- Migration — Item artwork (poster / cover / key art)   (2026-09-19)
-- ============================================================
-- Adds ONE nullable column to media_items:
--
--   image_url TEXT NULL   -- a LINK to the provider's image CDN
--
-- We store the link, never the bytes. The file stays on TMDB / Open Library /
-- RAWG's CDN and is fetched by the viewer's browser, so this feature costs the
-- project zero Supabase Storage and zero egress. See DATA_MODEL § 6.10 for the
-- trade-off (link rot vs. storage, bandwidth and image rights).
--
-- Because ANY group member can UPDATE media_items, an unconstrained URL column
-- would let one member point every viewer's browser at a server of their
-- choosing (IP logging, tracking pixels, junk images). The column is therefore
-- restricted to the image hosts of the three providers the app already trusts,
-- mirroring safeImageUrl() in lib/utils.ts. Keep the two in sync.
--
-- Additive and safe to run once: existing rows keep NULL. There is no backfill
-- — an item linked before this migration gets its artwork when a member hits
-- "Fetch artwork" in the edit dialog (one provider call, on demand).
--
-- Depends on: § 8 (External Identification Layer).

ALTER TABLE public.media_items
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- https only, provider image hosts only, length-capped.
--   TMDB            https://image.tmdb.org/t/p/w185/<poster_path>
--   Open Library    https://covers.openlibrary.org/b/id/<cover_id>-M.jpg
--   RAWG            https://media.rawg.io/media/resize/420/-/games/<...>.jpg
ALTER TABLE public.media_items
  DROP CONSTRAINT IF EXISTS image_url_provider_host;
ALTER TABLE public.media_items
  ADD CONSTRAINT image_url_provider_host
    CHECK (
      image_url IS NULL
      OR (
        char_length(image_url) <= 500
        AND image_url ~ '^https://(image\.tmdb\.org|covers\.openlibrary\.org|media\.rawg\.io)/'
      )
    );

COMMENT ON COLUMN public.media_items.image_url IS
  'Poster/cover/key art for the item, as a LINK to the provider image CDN (never copied into Supabase Storage). NULL when unknown, unavailable, or removed by a member. Restricted by CHECK to image.tmdb.org | covers.openlibrary.org | media.rawg.io.';

-- RLS / privileges: nothing changes. The new column rides the existing
-- media_items policies — members of the item's group may write it, exactly like
-- title/genre/metadata, and it is NOT part of the added_by immutability rule.

-- Verify (optional):
--   SELECT image_url FROM public.media_items WHERE image_url IS NOT NULL LIMIT 5;
--   -- should be rejected:
--   UPDATE public.media_items SET image_url = 'http://evil.example/p.jpg' WHERE false;
