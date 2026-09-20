'use client';

// ============================================================================
// useItemVerdicts — where the GROUP stands on one item, read fresh when you
// open it.
//
// The archive list already carries everyone's completions, so the sheet can
// draw the room the instant it opens. What the list does NOT carry is (a) the
// other members' in-progress statuses — it only loads the viewer's own and
// everybody's opt-outs, because a list of sixty rows has no space for six
// statuses each — and (b) the notes and ratings people leave, which are the
// whole point of opening an item in a shared archive.
//
// So the sheet pays two small queries, for ONE item, when it opens: who is
// where, and who said what. Nothing is polled and nothing is prefetched.
//
// RATINGS ARE OPTIONAL AND SELF-DETECTING. `consumption_records.rating` ships
// as a migration (docs/migrations/2026-09-20_item_ratings.sql). Until it is
// run, the first query fails on the unknown column, the hook remembers that for
// the session, re-asks without it, and the sheet simply does not offer stars.
// Everything else works untouched. Run the migration and they appear.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ItemStatus } from '@/types';

export interface Verdict {
  userId: string;
  nickname: string | null;
  consumedAt: string;
  note: string | null;
  /** 1–5, or null when the member has not rated (or ratings are not enabled). */
  rating: number | null;
}

/**
 * Tri-state, module-scoped so the probe happens once per session rather than
 * once per sheet: null = not asked yet, true = the column is there, false = it
 * is not and we must not ask for it again.
 */
let ratingColumn: boolean | null = null;

type ProfileJoin = { nickname: string } | { nickname: string }[] | null;

interface Row {
  user_id: string;
  consumed_at: string;
  note: string | null;
  rating?: number | null;
  profiles: ProfileJoin;
}

function nicknameOf(profiles: ProfileJoin): string | null {
  const profile = Array.isArray(profiles) ? profiles[0] : profiles;
  return profile?.nickname ?? null;
}

const BASE_COLUMNS = 'user_id, consumed_at, note, profiles(nickname)';
const RATED_COLUMNS = 'user_id, consumed_at, note, rating, profiles(nickname)';

export function useItemVerdicts({
  itemId,
  enabled,
}: {
  itemId: string | null;
  enabled: boolean;
}) {
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ItemStatus>>({});
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [ratingsEnabled, setRatingsEnabled] = useState(ratingColumn === true);

  const load = useCallback(async () => {
    if (!itemId) return;
    const supabase = createClient();
    setLoading(true);

    const readRecords = async () => {
      const wanted = ratingColumn === false ? BASE_COLUMNS : RATED_COLUMNS;
      const first = await supabase
        .from('consumption_records')
        .select(wanted)
        .eq('media_item_id', itemId);

      if (!first.error) {
        if (ratingColumn === null) ratingColumn = wanted === RATED_COLUMNS;
        return first.data as unknown as Row[];
      }
      // The probe failed. The expected reason is "there is no rating column"
      // (the migration has not been run), but ANY failure of the wider read is
      // answered the same way — fall back to the columns that have always been
      // there and remember it for the session. Showing the room without stars
      // is right; showing an empty room because of one unknown column is not.
      if (wanted === RATED_COLUMNS) {
        ratingColumn = false;
        const retry = await supabase
          .from('consumption_records')
          .select(BASE_COLUMNS)
          .eq('media_item_id', itemId);
        return (retry.data ?? []) as unknown as Row[];
      }
      return [] as Row[];
    };

    const [rows, statusResult] = await Promise.all([
      readRecords(),
      supabase.from('item_statuses').select('user_id, status').eq('media_item_id', itemId),
    ]);

    setVerdicts(
      rows.map((row) => ({
        userId: row.user_id,
        nickname: nicknameOf(row.profiles),
        consumedAt: row.consumed_at,
        note: row.note,
        rating: typeof row.rating === 'number' ? row.rating : null,
      })),
    );
    setStatuses(
      Object.fromEntries(
        (statusResult.data ?? []).map((row) => [row.user_id as string, row.status as ItemStatus]),
      ),
    );
    setRatingsEnabled(ratingColumn === true);
    setLoading(false);
    setLoaded(true);
  }, [itemId]);

  useEffect(() => {
    if (!enabled || !itemId) return;
    setLoaded(false);
    void load();
  }, [enabled, itemId, load]);

  /**
   * Write the viewer's own line — their note, their rating, or both.
   *
   * It is an upsert on (media_item_id, user_id), which is the row that already
   * means "I finished this", so a verdict can never exist without the
   * completion it belongs to. Applied optimistically: a note you have just
   * typed must not blink out and back.
   */
  const saveMine = useCallback(
    async (
      userId: string,
      nickname: string | null,
      patch: { note?: string | null; rating?: number | null },
    ) => {
      if (!itemId) return { error: null as string | null };

      const previous = verdicts;
      setVerdicts((current) => {
        const index = current.findIndex((entry) => entry.userId === userId);
        if (index === -1) {
          return [
            ...current,
            {
              userId,
              nickname,
              consumedAt: new Date().toISOString(),
              note: patch.note ?? null,
              rating: patch.rating ?? null,
            },
          ];
        }
        const next = [...current];
        next[index] = { ...next[index], ...patch };
        return next;
      });

      const supabase = createClient();
      const payload: Record<string, unknown> = { media_item_id: itemId, user_id: userId };
      if ('note' in patch) payload.note = patch.note;
      if ('rating' in patch && ratingColumn !== false) payload.rating = patch.rating;

      const { error } = await supabase
        .from('consumption_records')
        .upsert(payload, { onConflict: 'media_item_id,user_id' });

      if (error) {
        setVerdicts(previous);
        return { error: error.message };
      }
      return { error: null };
    },
    [itemId, verdicts],
  );

  return { verdicts, statuses, loading, loaded, ratingsEnabled, refresh: load, saveMine };
}
