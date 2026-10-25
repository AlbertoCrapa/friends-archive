import type { ExternalWork } from '@/types';

const norm = (value: string) => value.trim().toLowerCase();

/**
 * The provider result a title typed offline can be linked to WITHOUT asking.
 *
 * Only when there is no doubt: exactly one result carries the same name (and,
 * when a year was typed, the same year). "Inception" is one film; "Dune" is
 * three, and guessing between them would quietly attach the wrong poster, the
 * wrong director and the wrong link to somebody's archive. Null means "ask".
 */
export function confidentMatch(
  title: string,
  year: number | null,
  results: ExternalWork[],
): ExternalWork | null {
  let same = results.filter((work) => norm(work.title) === norm(title));
  if (year) same = same.filter((work) => work.year === year);
  return same.length === 1 ? same[0] : null;
}
