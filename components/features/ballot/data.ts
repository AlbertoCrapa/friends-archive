import type { ItemStatus, MediaType } from '@/types';

/**
 * Seed data for the ballot sheet. It stands in for the group archive so the
 * page can be opened without a session; the shapes follow types/index.ts so
 * the same components drop onto real rows later.
 */

export interface Member {
  id: string;
  name: string;
  you?: boolean;
}

export interface Mark {
  memberId: string;
  status: ItemStatus;
  /** 1–5, or absent when they have not rated it. */
  rating?: number;
}

export interface Entry {
  id: string;
  title: string;
  type: MediaType;
  year: number;
  credit: string;
  /** Human length, in the unit that type is measured in. */
  length: string;
  addedBy: string;
  addedAgo: string;
  tags: string[];
  /** Rough minutes to get through it, for "what can we finish tonight". */
  effort: number;
  /** Days since it was added, for ordering by what has waited longest. */
  addedDays: number;
  marks: Mark[];
  yourStatus: ItemStatus;
  /** 0 means you have not marked it. */
  yourRating: number;
}

export const YOU = 'you';

export const MEMBERS: Member[] = [
  { id: 'you', name: 'You', you: true },
  { id: 'maya', name: 'Maya' },
  { id: 'theo', name: 'Theo' },
  { id: 'ines', name: 'Ines' },
  { id: 'bruno', name: 'Bruno' },
  { id: 'kadi', name: 'Kadi' },
];

export const ENTRIES: Entry[] = [
  {
    id: 'perfect-days',
    title: 'Perfect Days',
    type: 'movie',
    year: 2023,
    credit: 'Wim Wenders',
    length: '2h 04m',
    addedBy: 'Ines',
    addedAgo: '3 weeks ago',
    tags: ['quiet', 'tokyo'],
    effort: 124,
    addedDays: 21,
    marks: [
      { memberId: 'maya', status: 'completed', rating: 5 },
      { memberId: 'theo', status: 'completed', rating: 4 },
      { memberId: 'ines', status: 'completed', rating: 5 },
      { memberId: 'bruno', status: 'consuming' },
      { memberId: 'kadi', status: 'plan_to_consume' },
    ],
    yourStatus: 'plan_to_consume',
    yourRating: 0,
  },
  {
    id: 'past-lives',
    title: 'Past Lives',
    type: 'movie',
    year: 2023,
    credit: 'Celine Song',
    length: '1h 45m',
    addedBy: 'Maya',
    addedAgo: '5 weeks ago',
    tags: ['slow burn'],
    effort: 105,
    addedDays: 35,
    marks: [
      { memberId: 'maya', status: 'completed', rating: 5 },
      { memberId: 'theo', status: 'completed', rating: 3 },
      { memberId: 'ines', status: 'completed', rating: 4 },
      { memberId: 'bruno', status: 'completed', rating: 4 },
      { memberId: 'kadi', status: 'not_interested' },
    ],
    yourStatus: 'completed',
    yourRating: 4,
  },
  {
    id: 'flow',
    title: 'Flow',
    type: 'movie',
    year: 2024,
    credit: 'Gints Zilbalodis',
    length: '1h 25m',
    addedBy: 'Kadi',
    addedAgo: '6 days ago',
    tags: ['animation', 'no dialogue'],
    effort: 85,
    addedDays: 6,
    marks: [
      { memberId: 'maya', status: 'plan_to_consume' },
      { memberId: 'theo', status: 'completed', rating: 5 },
      { memberId: 'ines', status: 'plan_to_consume' },
      { memberId: 'bruno', status: 'plan_to_consume' },
      { memberId: 'kadi', status: 'completed', rating: 5 },
    ],
    yourStatus: 'plan_to_consume',
    yourRating: 0,
  },
  {
    id: 'the-bear',
    title: 'The Bear',
    type: 'tv_series',
    year: 2022,
    credit: 'Christopher Storer',
    length: '4 seasons',
    addedBy: 'Theo',
    addedAgo: '4 months ago',
    tags: ['kitchen', 'loud'],
    effort: 1560,
    addedDays: 120,
    marks: [
      { memberId: 'maya', status: 'completed', rating: 4 },
      { memberId: 'theo', status: 'completed', rating: 5 },
      { memberId: 'ines', status: 'consuming' },
      { memberId: 'bruno', status: 'not_interested' },
      { memberId: 'kadi', status: 'consuming' },
    ],
    yourStatus: 'consuming',
    yourRating: 0,
  },
  {
    id: 'pachinko',
    title: 'Pachinko',
    type: 'tv_series',
    year: 2022,
    credit: 'Soo Hugh',
    length: '2 seasons',
    addedBy: 'Ines',
    addedAgo: '2 months ago',
    tags: ['family', 'subtitles'],
    effort: 900,
    addedDays: 61,
    marks: [
      { memberId: 'maya', status: 'consuming' },
      { memberId: 'theo', status: 'plan_to_consume' },
      { memberId: 'ines', status: 'completed', rating: 5 },
      { memberId: 'bruno', status: 'plan_to_consume' },
      { memberId: 'kadi', status: 'plan_to_consume' },
    ],
    yourStatus: 'plan_to_consume',
    yourRating: 0,
  },
  {
    id: 'shogun',
    title: 'Shogun',
    type: 'tv_series',
    year: 2024,
    credit: 'Justin Marks',
    length: '1 season',
    addedBy: 'Bruno',
    addedAgo: '7 weeks ago',
    tags: ['long nights'],
    effort: 600,
    addedDays: 49,
    marks: [
      { memberId: 'maya', status: 'completed', rating: 4 },
      { memberId: 'theo', status: 'completed', rating: 4 },
      { memberId: 'ines', status: 'not_interested' },
      { memberId: 'bruno', status: 'completed', rating: 5 },
      { memberId: 'kadi', status: 'completed', rating: 3 },
    ],
    yourStatus: 'completed',
    yourRating: 4,
  },
  {
    id: 'piranesi',
    title: 'Piranesi',
    type: 'book',
    year: 2020,
    credit: 'Susanna Clarke',
    length: '245 pages',
    addedBy: 'Maya',
    addedAgo: '9 days ago',
    tags: ['strange', 'short'],
    effort: 300,
    addedDays: 9,
    marks: [
      { memberId: 'maya', status: 'completed', rating: 5 },
      { memberId: 'theo', status: 'plan_to_consume' },
      { memberId: 'ines', status: 'consuming' },
      { memberId: 'bruno', status: 'plan_to_consume' },
      { memberId: 'kadi', status: 'plan_to_consume' },
    ],
    yourStatus: 'plan_to_consume',
    yourRating: 0,
  },
  {
    id: 'tomorrow',
    title: 'Tomorrow, and Tomorrow, and Tomorrow',
    type: 'book',
    year: 2022,
    credit: 'Gabrielle Zevin',
    length: '401 pages',
    addedBy: 'Kadi',
    addedAgo: '3 months ago',
    tags: ['games', 'friendship'],
    effort: 520,
    addedDays: 92,
    marks: [
      { memberId: 'maya', status: 'completed', rating: 3 },
      { memberId: 'theo', status: 'completed', rating: 4 },
      { memberId: 'ines', status: 'completed', rating: 4 },
      { memberId: 'bruno', status: 'consuming' },
      { memberId: 'kadi', status: 'completed', rating: 5 },
    ],
    yourStatus: 'completed',
    yourRating: 3,
  },
  {
    id: 'outer-wilds',
    title: 'Outer Wilds',
    type: 'video_game',
    year: 2019,
    credit: 'Mobius Digital',
    length: '~22 hours',
    addedBy: 'Theo',
    addedAgo: '5 months ago',
    tags: ['space', 'spoilers matter'],
    effort: 1320,
    addedDays: 152,
    marks: [
      { memberId: 'maya', status: 'not_interested' },
      { memberId: 'theo', status: 'completed', rating: 5 },
      { memberId: 'ines', status: 'plan_to_consume' },
      { memberId: 'bruno', status: 'completed', rating: 5 },
      { memberId: 'kadi', status: 'consuming' },
    ],
    yourStatus: 'consuming',
    yourRating: 0,
  },
  {
    id: 'disco-elysium',
    title: 'Disco Elysium',
    type: 'video_game',
    year: 2019,
    credit: 'ZA/UM',
    length: '~35 hours',
    addedBy: 'Bruno',
    addedAgo: '6 months ago',
    tags: ['reading', 'very long'],
    effort: 2100,
    addedDays: 183,
    marks: [
      { memberId: 'maya', status: 'not_interested' },
      { memberId: 'theo', status: 'consuming' },
      { memberId: 'ines', status: 'not_interested' },
      { memberId: 'bruno', status: 'completed', rating: 5 },
      { memberId: 'kadi', status: 'plan_to_consume' },
    ],
    yourStatus: 'plan_to_consume',
    yourRating: 0,
  },
  {
    id: 'anatomy-of-a-fall',
    title: 'Anatomy of a Fall',
    type: 'movie',
    year: 2023,
    credit: 'Justine Triet',
    length: '2h 32m',
    addedBy: 'Theo',
    addedAgo: '11 days ago',
    tags: ['courtroom', 'argue after'],
    effort: 152,
    addedDays: 11,
    marks: [
      { memberId: 'maya', status: 'plan_to_consume' },
      { memberId: 'theo', status: 'completed', rating: 4 },
      { memberId: 'ines', status: 'plan_to_consume' },
      { memberId: 'bruno', status: 'plan_to_consume' },
      { memberId: 'kadi', status: 'plan_to_consume' },
    ],
    yourStatus: 'plan_to_consume',
    yourRating: 0,
  },
];

/** Ratings on record for an entry, yours included. */
export function ratingsOf(entry: Entry): { memberId: string; rating: number }[] {
  const others = entry.marks
    .filter((m): m is Mark & { rating: number } => typeof m.rating === 'number' && m.rating > 0)
    .map((m) => ({ memberId: m.memberId, rating: m.rating }));
  return entry.yourRating > 0 ? [...others, { memberId: YOU, rating: entry.yourRating }] : others;
}

export function scoreOf(entry: Entry): number | null {
  const ratings = ratingsOf(entry);
  if (!ratings.length) return null;
  return ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
}

/** Members who have not finished it and have not opted out. */
export function waitingOn(entry: Entry): string[] {
  const names = entry.marks
    .filter((m) => m.status === 'plan_to_consume' || m.status === 'consuming')
    .map((m) => MEMBERS.find((x) => x.id === m.memberId)?.name ?? m.memberId);
  if (entry.yourStatus === 'plan_to_consume' || entry.yourStatus === 'consuming') names.unshift('you');
  return names;
}
