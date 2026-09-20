// ============================================================================
// Shared helpers for the item STORY — the on-demand half of the external layer.
//
// Search and details are written into our own columns when an item is created.
// The story is the opposite: it is never stored on the row, it is read when
// somebody opens the item and cached (see @/types ItemStory and DATA_MODEL
// § 6.11). These helpers exist so all three providers hand the UI the same
// shape, cleaned to the same standard.
// ============================================================================

/**
 * How long Next may serve a story from its own server-side cache.
 *
 * A day. Nothing in a story changes faster than that — a synopsis is written
 * once and a vote average moves in the third decimal — and because that cache
 * is shared between users, one day means AT MOST one upstream call per title
 * per day no matter how many friends open it. With every provider's free tier
 * measured in tens of thousands of calls a month, an archive would have to hold
 * several hundred titles, all opened daily, before this is worth a second
 * thought.
 */
export const STORY_REVALIDATE_SECONDS = 86_400;

/** Synopses are trimmed to this. Longer than a paragraph nobody reads it. */
const SYNOPSIS_MAX = 900;

/**
 * Plain text out of whatever a provider calls a description.
 *
 * RAWG returns HTML in `description` (we ask for `description_raw`, but it is
 * not always clean), and Open Library returns a Markdown-ish blob that usually
 * ends with a line of source links in brackets. Both are rendered as text in
 * our UI, never as markup, so everything that is not a word comes out here.
 */
export function plainText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value
    // Tags first, so their content survives as words.
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    // Open Library's trailing source references: "([source][1])" / "[1]: http…"
    .replace(/\(\[[^\]]*\]\[\d+\]\)/g, '')
    .replace(/^\s*\[\d+\]:\s*\S+\s*$/gm, '')
    // Markdown links, kept as their label.
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > 0 ? text : undefined;
}

/**
 * Cut a synopsis to length at a sentence end rather than mid-word, so the
 * paragraph always finishes like a paragraph. Falls back to an ellipsis when
 * there is no sentence break to land on.
 */
export function trimSynopsis(value: unknown, max: number = SYNOPSIS_MAX): string | undefined {
  const text = plainText(value);
  if (!text) return undefined;
  if (text.length <= max) return text;

  const window = text.slice(0, max);
  const lastStop = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '));
  // Only honour a sentence break in the last third, or a two-line synopsis
  // would be cut to one.
  if (lastStop > max * 0.6) return window.slice(0, lastStop + 1);
  return `${window.replace(/\s+\S*$/, '')}…`;
}

/** The first `limit` names from a provider's people list, trimmed and unique. */
export function billedNames(
  people: Array<{ name?: string | null } | undefined> | undefined,
  limit = 6
): string[] | undefined {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const person of people ?? []) {
    const name = person?.name?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= limit) break;
  }
  return out.length > 0 ? out : undefined;
}

/** "ja" -> "Japanese". Falls back to the raw code where ICU has no name. */
export function languageName(code: unknown): string | undefined {
  if (typeof code !== 'string' || code.length < 2) return undefined;
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** "2024-05-17" -> "17 May 2024". Returns undefined for anything unparseable. */
export function longDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length < 4) return undefined;
  const date = new Date(value.length === 4 ? `${value}-01-01` : value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (value.length === 4) return value;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Drops facts whose value never materialised, so the table has no blank rows. */
export function factList(
  facts: Array<{ label: string; value?: string | number | null; url?: string }>
): Array<{ label: string; value: string; url?: string }> | undefined {
  const out = facts
    .filter((fact) => fact.value !== undefined && fact.value !== null && `${fact.value}`.trim() !== '')
    .map((fact) => ({ label: fact.label, value: `${fact.value}`.trim(), ...(fact.url ? { url: fact.url } : {}) }));
  return out.length > 0 ? out : undefined;
}
