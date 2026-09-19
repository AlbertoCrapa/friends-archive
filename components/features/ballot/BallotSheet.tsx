'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ItemStatus, MediaType } from '@/types';
import { BranchedMenu, type TreeSection } from '@/components/micro/BranchedMenu';
import { GlideSelect, type GlideOption } from '@/components/micro/GlideSelect';
import { PeekRating, RATING_WORDS } from '@/components/micro/PeekRating';
import { RubberSegment } from '@/components/micro/RubberSegment';
import { SpringCheck } from '@/components/micro/SpringCheck';
import { SwipeRow, type SwipeAction } from '@/components/micro/SwipeRow';
import { SwipeToast, type ToastPayload } from '@/components/micro/SwipeToast';
import { WarmTooltipGroup } from '@/components/micro/WarmTooltip';
import { MemberMarks, SHORT, Tally, TypeStamp } from './Pieces';
import { ENTRIES, MEMBERS, scoreOf, waitingOn, type Entry } from './data';
import { INTERACTION_INDEX } from './index-notes';

const TYPES: { value: MediaType | 'all'; label: string }[] = [
  { value: 'all', label: 'Everything' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv_series', label: 'Series' },
  { value: 'book', label: 'Books' },
  { value: 'video_game', label: 'Games' },
];

const SORTS: GlideOption[] = [
  { value: 'waiting', label: 'Fewest people left', hint: 'default' },
  { value: 'score', label: 'Best rated by us' },
  { value: 'effort', label: 'Shortest first' },
  { value: 'fresh', label: 'Newest in the archive' },
];

const fmt = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

export function BallotSheet() {
  const [entries, setEntries] = useState<Entry[]>(ENTRIES);
  const [sheet, setSheet] = useState('sheet:ballot');
  const [type, setType] = useState<MediaType | 'all'>('all');
  const [sort, setSort] = useState('waiting');
  const [hideFinished, setHideFinished] = useState(false);
  const [hideOut, setHideOut] = useState(true);
  const [hideUnrated, setHideUnrated] = useState(false);
  const [selectedId, setSelectedId] = useState(() => frontRunner(ENTRIES));
  const [preview, setPreview] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState('');
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const [narrow, setNarrow] = useState(false);

  // The index opens itself on a wide sheet and stays folded on a phone, where
  // the queue is what you came for.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)');
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const hero = entries.find((e) => e.id === selectedId) ?? entries[0];
  const heroScore = scoreOf(hero);
  const heroWaiting = waitingOn(hero);

  const visible = useMemo(() => {
    let list = entries;

    if (sheet.startsWith('waiting:')) {
      const who = sheet.slice('waiting:'.length);
      list = list.filter((e) =>
        e.marks.some((m) => m.memberId === who && (m.status === 'plan_to_consume' || m.status === 'consuming')),
      );
    } else if (sheet === 'sheet:ballot') {
      list = list.filter((e) => e.yourStatus === 'plan_to_consume' || e.yourStatus === 'consuming');
    } else if (sheet === 'sheet:finished') {
      list = list.filter((e) => e.yourStatus === 'completed');
    } else if (sheet === 'sheet:out') {
      list = list.filter((e) => e.yourStatus === 'not_interested');
    }

    if (type !== 'all') list = list.filter((e) => e.type === type);
    if (hideFinished) list = list.filter((e) => e.yourStatus !== 'completed');
    if (hideOut) list = list.filter((e) => e.yourStatus !== 'not_interested');
    if (hideUnrated) list = list.filter((e) => scoreOf(e) !== null);

    return [...list].sort((a, b) => {
      if (sort === 'score') return (scoreOf(b) ?? -1) - (scoreOf(a) ?? -1);
      if (sort === 'effort') return a.effort - b.effort;
      if (sort === 'fresh') return a.addedDays - b.addedDays;
      return waitingOn(a).length - waitingOn(b).length;
    });
  }, [entries, hideFinished, hideOut, hideUnrated, sheet, sort, type]);

  const sections: TreeSection[] = useMemo(
    () => [
      {
        id: 'sheets',
        label: 'Sheets',
        items: [
          { id: 'sheet:ballot', label: 'Up for a vote', hint: String(countBallot(entries)) },
          { id: 'sheet:all', label: 'Everything', hint: String(entries.length) },
          { id: 'sheet:finished', label: 'Finished', hint: String(entries.filter((e) => e.yourStatus === 'completed').length) },
          { id: 'sheet:out', label: 'Not for me', hint: String(entries.filter((e) => e.yourStatus === 'not_interested').length) },
        ],
      },
      {
        id: 'waiting',
        label: 'Waiting on',
        items: MEMBERS.filter((m) => !m.you).map((m) => ({
          id: `waiting:${m.id}`,
          label: m.name,
          hint: String(
            entries.filter((e) =>
              e.marks.some((k) => k.memberId === m.id && (k.status === 'plan_to_consume' || k.status === 'consuming')),
            ).length,
          ),
        })),
      },
    ],
    [entries],
  );

  const say = (message: ReactNode, actionLabel?: string, onAction?: () => void) =>
    setToast({ id: `${Date.now()}`, message, actionLabel, onAction });

  const setStatus = (entry: Entry, status: ItemStatus) => {
    const was = entry.yourStatus;
    setEntries((list) => list.map((e) => (e.id === entry.id ? { ...e, yourStatus: status } : e)));
    const undo = () => setEntries((list) => list.map((e) => (e.id === entry.id ? { ...e, yourStatus: was } : e)));

    if (status === 'not_interested') {
      say(
        <>
          You are out on <b>{entry.title}</b>. The group keeps it.
        </>,
        'Undo',
        undo,
      );
    } else if (status === 'consuming') {
      say(
        <>
          Started <b>{entry.title}</b>.
        </>,
        'Undo',
        undo,
      );
    } else if (status === 'completed') {
      say(
        <>
          Finished <b>{entry.title}</b>. Rate it while it is fresh.
        </>,
        'Rate it',
        () => {
          setSelectedId(entry.id);
          document.getElementById('slip')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },
      );
    } else {
      say(
        <>
          Back in the queue: <b>{entry.title}</b>.
        </>,
        'Undo',
        undo,
      );
    }
  };

  const rate = (entry: Entry, value: number) => {
    const was = entry.yourRating;
    setEntries((list) => list.map((e) => (e.id === entry.id ? { ...e, yourRating: value } : e)));
    setPreview(null);
    if (value === 0) {
      say(<>Your mark on <b>{entry.title}</b> is off the record.</>, 'Undo', () =>
        setEntries((list) => list.map((e) => (e.id === entry.id ? { ...e, yourRating: was } : e))),
      );
      return;
    }
    say(
      <>
        <b>{entry.title}</b> marked {value} of 5. {RATING_WORDS[value - 1]}.
      </>,
      'Undo',
      () => setEntries((list) => list.map((e) => (e.id === entry.id ? { ...e, yourRating: was } : e))),
    );
  };

  const rowActions = (entry: Entry): SwipeAction[] => {
    if (entry.yourStatus === 'not_interested') {
      return [{ id: 'back', label: 'Back in', tone: 'start', onSelect: () => setStatus(entry, 'plan_to_consume') }];
    }
    return [
      { id: 'out', label: 'Not for me', tone: 'out', onSelect: () => setStatus(entry, 'not_interested') },
      entry.yourStatus === 'consuming'
        ? { id: 'done', label: 'Finished', tone: 'start', onSelect: () => setStatus(entry, 'completed') }
        : { id: 'start', label: 'Start it', tone: 'start', onSelect: () => setStatus(entry, 'consuming') },
    ];
  };

  const liveLine = preview
    ? `If you mark it ${preview}, we land on ${fmt(withPreview(hero, preview))}.`
    : hero.yourRating > 0
      ? `You marked it ${hero.yourRating} of 5. ${RATING_WORDS[hero.yourRating - 1]}.`
      : 'You have not marked this one. Sweep the stars to see where it lands before you commit.';

  return (
    <div className="bl">
      <WarmTooltipGroup>
        <header className="bl-masthead">
          <span className="bl-wordmark">The Friend Archive</span>
          <div className="bl-masthead-meta">
            <span className="bl-label">Ballot 14</span>
            <span className="bl-label">6 members</span>
            <span className="bl-label">{entries.length} slips on the shelf</span>
          </div>
        </header>

        <div className="bl-frame">
          <aside className="bl-rail">
            <BranchedMenu
              key={narrow ? 'folded' : 'open'}
              sections={sections}
              value={sheet}
              onChange={setSheet}
              defaultOpen={narrow ? [] : ['sheets']}
            />
            <p className="bl-rail-foot">
              Titles are shared. Marks are not: your status and your rating belong to you alone, which is why yours
              reads brighter than the rest.
            </p>
          </aside>

          <main className="bl-sheet">
            <section className="bl-hero">
              <h1 className="bl-display">What are we starting on Friday?</h1>
              <p className="bl-body" style={{ marginTop: '1.15rem' }}>
                Six of us mark the same archive. Your own marks read brighter than everyone else&rsquo;s, and where two
                people land on the same star the gold stacks up. Agreement is the part you can see from across the
                room.
              </p>

              <article className="bl-slip" id="slip">
                <div className="bl-slip-head">
                  <span>Slip {String(ENTRIES.findIndex((e) => e.id === hero.id) + 1).padStart(2, '0')}</span>
                  <span>
                    {heroWaiting.length
                      ? `${heroWaiting.length} of 6 still to go`
                      : 'Everyone is through it'}
                  </span>
                </div>
                <div className="bl-slip-main">
                  <div className="bl-hero-kicker">
                    <TypeStamp type={hero.type} />
                    <div style={{ minWidth: 0 }}>
                      <h2 className="bl-slip-title">{hero.title}</h2>
                      <p className="bl-credits">
                        {hero.credit}, {hero.year}. {hero.length}.
                      </p>
                    </div>
                  </div>

                  <MemberMarks entry={hero} withNames />

                  <div className="bl-rate-block">
                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      <div>
                        <p className="bl-label" style={{ marginBottom: '0.3rem' }}>
                          Your mark
                        </p>
                        <PeekRating
                          value={hero.yourRating}
                          onChange={(v) => rate(hero, v)}
                          onPreview={setPreview}
                          size={28}
                        />
                      </div>
                      <div style={{ flex: '1 1 12rem', minWidth: '11rem' }}>
                        <p className="bl-label" style={{ marginBottom: '0.3rem' }}>
                          Where the marks landed
                        </p>
                        <Tally entry={hero} preview={preview} />
                      </div>
                    </div>

                    <p className="bl-fig" aria-live="polite">
                      {liveLine}
                    </p>

                    {hero.yourRating > 0 ? (
                      <div className="bl-note">
                        <label className="bl-label" htmlFor="note">
                          Say why, in as many words as it deserves
                        </label>
                        <textarea
                          id="note"
                          value={draft || notes[hero.id] || ''}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="Three words is plenty."
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="bl-btn"
                            disabled={!draft.trim()}
                            onClick={() => {
                              setNotes((n) => ({ ...n, [hero.id]: draft.trim() }));
                              setDraft('');
                              say(
                                <>
                                  Note saved on <b>{hero.title}</b>.
                                </>,
                              );
                            }}
                          >
                            Save note
                          </button>
                          {notes[hero.id] ? <span className="bl-fig">Saved.</span> : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="bl-slip-side">
                  <div className="bl-field">
                    <span className="bl-label">Group score</span>
                    <span className="bl-field-value bl-num" style={{ fontSize: '1.6rem', fontWeight: 650 }}>
                      {heroScore === null ? 'Unrated' : fmt(heroScore)}
                    </span>
                    <span className="bl-label">
                      {heroScore === null ? 'Nobody has marked it' : `from ${countRatings(hero)} marks`}
                    </span>
                  </div>

                  <div className="bl-field">
                    <span className="bl-label">Waiting on</span>
                    <span className="bl-field-value">
                      {heroWaiting.length ? heroWaiting.join(', ') : 'Nobody. Everyone is through it.'}
                    </span>
                  </div>

                  <div className="bl-field">
                    <span className="bl-label">Added</span>
                    <span className="bl-field-value">
                      {hero.addedBy}, {hero.addedAgo}
                    </span>
                  </div>

                  <div className="bl-field">
                    <span className="bl-label">Tagged</span>
                    <span className="bl-field-value">{hero.tags.join(', ')}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: 'auto' }}>
                    <button type="button" className="bl-btn" onClick={() => setStatus(hero, 'consuming')}>
                      Start it
                    </button>
                    <button
                      type="button"
                      className="bl-btn"
                      data-variant="quiet"
                      onClick={() => setStatus(hero, 'not_interested')}
                    >
                      Not for me
                    </button>
                  </div>
                </div>
              </article>
            </section>

            <section>
              <div className="bl-section">
                <h2 className="bl-h2">The queue</h2>
                <span className="bl-section-line" />
                <span className="bl-section-no bl-num">Sheet 2</span>
              </div>

              <div className="bl-filters">
                <div className="bl-filters-row">
                  <RubberSegment
                    options={TYPES.map((t) => ({ value: String(t.value), label: t.label }))}
                    value={String(type)}
                    onChange={(v) => setType(v as MediaType | 'all')}
                    ariaLabel="Filter by kind"
                  />
                  <div className="bl-filters-spacer" />
                  <GlideSelect options={SORTS} value={sort} onChange={setSort} label="Order by" align="right" />
                  <span className="bl-count bl-num">
                    {visible.length} of {entries.length}
                  </span>
                </div>
                <div className="bl-filters-row">
                  <SpringCheck checked={hideFinished} onChange={setHideFinished} label="Finished" />
                  <SpringCheck checked={hideOut} onChange={setHideOut} label="Not for me" />
                  <SpringCheck checked={hideUnrated} onChange={setHideUnrated} label="Nobody rated it" />
                  <span className="bl-label">struck from this list</span>
                </div>
              </div>

              {visible.length ? (
                <ul className="bl-queue">
                  <AnimatePresence initial={false}>
                    {visible.map((entry) => {
                      const score = scoreOf(entry);
                      const out = entry.yourStatus === 'not_interested';
                      return (
                        <motion.li key={entry.id} layout exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                          <SwipeRow
                            actions={rowActions(entry)}
                            label={`Actions for ${entry.title}`}
                            onCommit={() => undefined}
                          >
                            <div className="bl-row" data-out={out} data-selected={entry.id === selectedId}>
                              <TypeStamp type={entry.type} out={out} />
                              <div className="bl-row-body">
                                <button type="button" className="bl-row-title" onClick={() => setSelectedId(entry.id)}>
                                  {entry.title}
                                </button>
                                <div className="bl-row-meta">
                                  <span>{SHORT[entry.type]}</span>
                                  <span>{entry.credit}</span>
                                  <span>{entry.year}</span>
                                  <span>{entry.length}</span>
                                </div>
                              </div>
                              <div className="bl-row-right">
                                <MemberMarks entry={entry} />
                                <div className="bl-score bl-num" data-empty={score === null}>
                                  <span className="bl-score-value">{score === null ? 'Unrated' : fmt(score)}</span>
                                  {score === null ? null : <span className="bl-score-of">of 5</span>}
                                </div>
                              </div>
                            </div>
                          </SwipeRow>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              ) : (
                <div className="bl-empty">
                  <h3 className="bl-h3">Nothing on this sheet</h3>
                  <p className="bl-body">
                    The filters above struck everything out. Put one back and the rows return.
                  </p>
                  <button
                    type="button"
                    className="bl-btn"
                    onClick={() => {
                      setType('all');
                      setHideFinished(false);
                      setHideOut(false);
                      setHideUnrated(false);
                      setSheet('sheet:all');
                    }}
                  >
                    Show everything
                  </button>
                </div>
              )}

              <p className="bl-fig">
                <b>Fig 1.</b> Pull a row to the left to reach its actions. Keep pulling and the first action floods the
                row, which means letting go will run it. Every action on that drawer is also a button, because a
                gesture nobody finds is not a feature.
              </p>
            </section>

            <section>
              <div className="bl-section">
                <h2 className="bl-h2">Index of interactions</h2>
                <span className="bl-section-line" />
                <span className="bl-section-no bl-num">Sheet 3</span>
              </div>
              <p className="bl-body" style={{ marginBottom: '1.5rem' }}>
                Thirty-two micro-interactions were read against one question: does it carry meaning this archive
                actually has? Nine do. The rest are here with the reason they were left off, because the cuts are the
                design.
              </p>
              <ul className="bl-index">
                {INTERACTION_INDEX.map((item) => (
                  <li key={item.name} data-kept={item.kept}>
                    <span className="bl-index-verdict">{item.kept ? 'In' : 'Out'}</span>
                    <span>
                      <span className="bl-index-name">{item.name}</span>{' '}
                      <span className="bl-index-note">{item.note}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <div className="bl-section">
                <h2 className="bl-h2">How this page is built</h2>
                <span className="bl-section-line" />
                <span className="bl-section-no bl-num">Sheet 4</span>
              </div>
              <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(17rem, 1fr))' }}>
                <div>
                  <h3 className="bl-h3">One accent, one meaning</h3>
                  <p className="bl-body" style={{ marginTop: '0.4rem' }}>
                    Gold appears only where a rating is involved: the stars, the tally, the score. Green means
                    finished, red means you are out. Everything else is zinc, so colour never has to be decoded.
                  </p>
                </div>
                <div>
                  <h3 className="bl-h3">Motion answers you</h3>
                  <p className="bl-body" style={{ marginTop: '0.4rem' }}>
                    Nothing on this page moves on its own. Every animation is either a reply to something you did or a
                    report of a state that changed, and all of it stands down under reduced motion.
                  </p>
                </div>
                <div>
                  <h3 className="bl-h3">The components set the style</h3>
                  <p className="bl-body" style={{ marginTop: '0.4rem' }}>
                    The page is built out of the React Bits micro defaults and takes its vocabulary from them: #27272a
                    surfaces, #3f3f46 drawers, 16px rows, a 32px chip, one easing curve. Drop another one in tomorrow
                    and it needs no restyling.
                  </p>
                </div>
              </div>
            </section>
          </main>
        </div>

        <SwipeToast toast={toast} onDismiss={() => setToast(null)} />
      </WarmTooltipGroup>
    </div>
  );
}

function countRatings(entry: Entry) {
  return entry.marks.filter((m) => typeof m.rating === 'number').length + (entry.yourRating > 0 ? 1 : 0);
}

function withPreview(entry: Entry, preview: number) {
  const others = entry.marks.filter((m) => typeof m.rating === 'number').map((m) => m.rating as number);
  const all = [...others, preview];
  return all.reduce((s, r) => s + r, 0) / all.length;
}

function countBallot(entries: Entry[]) {
  return entries.filter((e) => e.yourStatus === 'plan_to_consume' || e.yourStatus === 'consuming').length;
}

/** The slip in your hand when the page opens: most marked, then best rated. */
function frontRunner(entries: Entry[]) {
  const open = entries.filter((e) => e.yourStatus === 'plan_to_consume' || e.yourStatus === 'consuming');
  const ranked = [...(open.length ? open : entries)].sort((a, b) => {
    const byCount = countRatings(b) - countRatings(a);
    if (byCount !== 0) return byCount;
    return (scoreOf(b) ?? 0) - (scoreOf(a) ?? 0);
  });
  return ranked[0].id;
}
