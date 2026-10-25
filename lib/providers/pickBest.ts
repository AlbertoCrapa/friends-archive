// The search result a recognized title most likely means. Pure — see
// pickBest.test.ts.

import type { ExternalWork } from '@/types';

const norm = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Exact title + year, then exact title, then year, then the provider's own
 * top hit (they already rank by relevance/popularity). A year off by one still
 * counts — festival vs. theatrical release dates disagree all the time.
 */
export function pickBest(
  results: ExternalWork[],
  title: string,
  year?: number
): ExternalWork | null {
  if (results.length === 0) return null;
  const want = norm(title);
  const sameTitle = (w: ExternalWork) => norm(w.title) === want;
  const sameYear = (w: ExternalWork) => !!year && !!w.year && Math.abs(w.year - year) <= 1;
  return (
    results.find((w) => sameTitle(w) && sameYear(w)) ??
    results.find(sameTitle) ??
    results.find(sameYear) ??
    results[0]
  );
}
