// npx tsx lib/providers/pickBest.test.ts
import assert from 'node:assert/strict';
import { pickBest } from './pickBest';
import type { ExternalWork } from '@/types';

const w = (title: string, year?: number) =>
  ({ external_id: `${title}:${year}`, title, year }) as ExternalWork;

const dunes = [w('Dune: Part Two', 2024), w('Dune', 1984), w('Dune', 2021)];
assert.equal(pickBest(dunes, 'Dune', 2021)?.year, 2021, 'title + year');
assert.equal(pickBest(dunes, 'dune')?.year, 1984, 'title beats provider rank');
assert.equal(pickBest(dunes, 'Dune Part 2', 2024)?.title, 'Dune: Part Two', 'year when title differs');
assert.equal(pickBest([w('Wallace & Gromit', 2005)], 'Wallace and Gromit')?.year, 2005, '& == and');
assert.equal(pickBest([w('Pokémon Legends: Z-A')], 'Pokemon Legends Z-A')?.title, 'Pokémon Legends: Z-A', 'accents');
assert.equal(pickBest([w('A'), w('B')], 'zzz')?.title, 'A', 'falls back to top hit');
assert.equal(pickBest([], 'x'), null);
console.log('pickBest ok');
