// bun test lib/offlineMatch.test.ts
import { expect, test } from 'bun:test';
import { confidentMatch } from './offlineMatch';
import type { ExternalWork } from '@/types';

const work = (title: string, year?: number) =>
  ({ title, year, external_id: `tmdb:movie:${title}${year}` }) as ExternalWork;

test('one exact title is confident', () => {
  const inception = work('Inception', 2010);
  expect(confidentMatch(' inception ', null, [inception, work('Inception: The Cobol Job', 2010)])).toBe(
    inception,
  );
});

test('several exact titles need a year', () => {
  const results = [work('Dune', 1984), work('Dune', 2021)];
  expect(confidentMatch('Dune', null, results)).toBeNull();
  expect(confidentMatch('Dune', 2021, results)).toBe(results[1]);
});

test('no exact title is not confident', () => {
  expect(confidentMatch('Dun', null, [work('Dune', 2021)])).toBeNull();
});
