'use client';

import { useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase/client';
import { confidentMatch } from '@/lib/offlineMatch';
import { likeLiteral, parseTags, safeImageUrl, serializeTags } from '@/lib/utils';
import type { ExternalWork, ItemStatus, MediaItem, MediaMetadata, MediaType } from '@/types';

// ============================================
// Offline mode for an installed group.
//
// READS come from the service worker (public/sw.js), which keeps the last good
// copy of every page, detail and poster the member opened while online.
// WRITES that are the member's own — their status, their rating and note, a new
// comment, a new bare title — go into an outbox in IndexedDB and are replayed,
// in order, when the connection comes back. Anything that changes what OTHER
// people have (deletes, edits to a shared item, transfers, admin actions) is
// refused while offline: it cannot be undone once it lands on top of changes
// made in the meantime, and there is nobody to ask.
// ============================================

type Client = ReturnType<typeof createClient>;
type WriteError = { message: string; code?: string } | null;

/** Exactly the columns a manual add writes, plus an id made on the device. */
export interface OfflineItemRow {
  id: string;
  group_id: string;
  added_by: string;
  title: string;
  type: MediaType;
  genre: string | null;
  metadata: Record<string, unknown>;
}

export type OfflineOp =
  | { kind: 'add_item'; userId: string; row: OfflineItemRow; status: ItemStatus; at: string }
  | { kind: 'status'; userId: string; itemIds: string[]; status: ItemStatus }
  | { kind: 'verdict'; userId: string; itemId: string; patch: Record<string, unknown> }
  | { kind: 'comment'; userId: string; itemId: string; id: string; body: string; at: string };

type StoredOp = OfflineOp & { seq: number };
type AddOp = Extract<OfflineOp, { kind: 'add_item' }>;

/** How a title added offline looks on screen until it syncs. */
export function offlineItem(op: AddOp): MediaItem & { status: ItemStatus } {
  return {
    ...op.row,
    metadata: op.row.metadata as MediaMetadata,
    external_id: null,
    external_source: null,
    external_url: null,
    image_url: null,
    created_at: op.at,
    updated_at: op.at,
    status: op.status,
  };
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

// --- Online state ---------------------------------------------------------

/**
 * `navigator.onLine` only knows whether there is a network, not whether it
 * reaches anything: a café's Wi-Fi login page says "online". So a write that
 * fails on the wire also flips this, until a probe gets through again.
 */
let forcedOffline = false;
let pending = 0;
let installPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    forcedOffline = false;
    emit();
  });
  window.addEventListener('offline', emit);
  // Fired once, early, by browsers that can install the page (not iOS). Held
  // here because the settings page that offers the button mounts much later.
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    emit();
  });
  void refreshPending();
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && (forcedOffline || !navigator.onLine);
}

export const useOffline = () => useSyncExternalStore(subscribe, isOffline, () => false);
export const usePendingCount = () => useSyncExternalStore(subscribe, () => pending, () => 0);
export const useInstallPrompt = () => useSyncExternalStore(subscribe, () => installPrompt, () => null);

export async function promptInstall() {
  if (!installPrompt) return;
  await installPrompt.prompt();
  installPrompt = null;
  emit();
}

function markOffline() {
  forcedOffline = true;
  emit();
}

/** Supabase reports a dropped connection as an error with no code. */
function isNetworkError(error: WriteError): boolean {
  return !!error && !error.code && /fetch|network|load failed/i.test(error.message);
}

/** Clears a forced offline once something actually gets through. */
export async function probe() {
  if (!forcedOffline || !navigator.onLine) return;
  try {
    // `__probe` tells the service worker to stay out of it: a cached answer
    // would prove nothing.
    const res = await fetch(`/icon.svg?__probe=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      forcedOffline = false;
      emit();
    }
  } catch {
    // still offline
  }
}

/**
 * The guard for everything that touches other people's things. True (and the
 * member is told why) when it has to wait for a connection.
 */
export function blockedOffline(toast: (request: { message: string }) => unknown): boolean {
  if (!isOffline()) return false;
  toast({ message: 'You are offline — this needs a connection. Try again once you are back online.' });
  return true;
}

// --- Outbox ---------------------------------------------------------------

const DB_NAME = 'friends-archive-offline';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function outbox<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction('outbox', mode).objectStore('outbox'));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

/** Everything still waiting, oldest first (the key is an autoincrement). */
export function pendingOps(): Promise<StoredOp[]> {
  return outbox<StoredOp[]>('readonly', (store) => store.getAll()).catch(() => []);
}

async function refreshPending() {
  pending = (await pendingOps()).length;
  emit();
}

async function enqueue(op: OfflineOp) {
  await outbox('readwrite', (store) => store.add(op));
  await refreshPending();
}

/**
 * Runs a write now, or keeps it for later.
 *
 * Offline, or when the write dies on the wire, the op goes into the outbox and
 * this resolves to null — the caller treats that as success, because for the
 * member it is: the change is on the device and will land. Any other failure
 * comes back as it would have without this wrapper.
 */
export async function writeOrQueue<R extends { error: WriteError }>(
  op: OfflineOp,
  write: () => PromiseLike<R>,
): Promise<R | null> {
  if (!isOffline()) {
    const result = await write();
    if (!isNetworkError(result.error)) return result;
    markOffline();
  }
  try {
    await enqueue(op);
    return null;
  } catch {
    // No IndexedDB (some private windows): say it failed, so the caller rolls back.
    return { error: { message: 'Could not save this change on the device.' } } as R;
  }
}

/**
 * The member's own status on a set of items, as the two writes it takes:
 * the status itself, then the consumption record 'completed' implies (and
 * clearing it removes), because "I finished it" is the one status the rest of
 * the group can see.
 */
export async function writeStatuses(
  supabase: Client,
  userId: string,
  ids: string[],
  status: ItemStatus,
) {
  const { error } = await supabase.from('item_statuses').upsert(
    ids.map((id) => ({ media_item_id: id, user_id: userId, status })),
    { onConflict: 'media_item_id,user_id' },
  );
  if (error) return { error };
  return status === 'completed'
    ? await supabase.from('consumption_records').upsert(
        ids.map((id) => ({ media_item_id: id, user_id: userId })),
        { onConflict: 'media_item_id,user_id' },
      )
    : await supabase
        .from('consumption_records')
        .delete()
        .eq('user_id', userId)
        .in('media_item_id', ids);
}

// --- Sync -----------------------------------------------------------------

export interface SyncReport {
  /** Ops that left the outbox, landed or dropped. */
  processed: number;
  /** Item fields the sync wrote, for the archive to merge into its rows. */
  updated: Array<{ id: string } & Record<string, unknown>>;
}

type Outcome = 'ok' | 'dropped' | 'stop';

/**
 * What a replayed write's error means for the queue.
 *
 *   stop    — the connection or the session is gone; keep this op and every
 *             one after it, in order, for the next try.
 *   dropped — the database said no for good (the item was deleted, the member
 *             was removed): say so and move on, or one dead op blocks the rest.
 *
 * A unique violation on a replayed insert means the first try DID land and
 * only its removal from the outbox was lost, so it counts as done.
 */
function settle(error: WriteError, what: string, notify: (message: string) => void): Outcome {
  if (!error || error.code === '23505') return 'ok';
  if (isNetworkError(error)) {
    markOffline();
    return 'stop';
  }
  if (error.code === 'PGRST301' || /jwt/i.test(error.message)) {
    notify('Sign in again to sync the changes you made offline.');
    return 'stop';
  }
  notify(`${what} could not sync — it may have been deleted or you may no longer be a member.`);
  return 'dropped';
}

let flushing = false;

/** Replays the outbox in order. Safe to call often; one run at a time. */
export async function flush(notify: (message: string) => void): Promise<SyncReport> {
  const report: SyncReport = { processed: 0, updated: [] };
  if (flushing || isOffline()) return report;
  flushing = true;
  try {
    const supabase = createClient();
    for (const op of await pendingOps()) {
      if ((await replay(supabase, op, notify, report)) === 'stop') break;
      await outbox('readwrite', (store) => store.delete(op.seq));
      report.processed += 1;
    }
  } finally {
    flushing = false;
    await refreshPending();
  }
  return report;
}

async function replay(
  supabase: Client,
  op: StoredOp,
  notify: (message: string) => void,
  report: SyncReport,
): Promise<Outcome> {
  switch (op.kind) {
    case 'status':
      return settle(
        (await writeStatuses(supabase, op.userId, op.itemIds, op.status)).error,
        'A status change',
        notify,
      );
    case 'verdict':
      return settle(
        (
          await supabase
            .from('consumption_records')
            .upsert(
              { media_item_id: op.itemId, user_id: op.userId, ...op.patch },
              { onConflict: 'media_item_id,user_id' },
            )
        ).error,
        'A rating or note',
        notify,
      );
    case 'comment':
      return settle(
        (
          await supabase
            .from('comments')
            .insert({ id: op.id, media_item_id: op.itemId, author_id: op.userId, body: op.body })
        ).error,
        'A comment',
        notify,
      );
    case 'add_item':
      return replayAdd(supabase, op, notify, report);
  }
}

/**
 * A title added offline: insert it as typed, then do the search the member
 * could not do. Linked automatically only when the match is certain; anything
 * else is left bare and flagged, because a wrong poster is worse than none.
 */
async function replayAdd(
  supabase: Client,
  op: AddOp,
  notify: (message: string) => void,
  report: SyncReport,
): Promise<Outcome> {
  const { row } = op;
  const label = `"${row.title}"`;

  const inserted = settle((await supabase.from('media_items').insert(row)).error, label, notify);
  if (inserted !== 'ok') return inserted;

  if (op.status !== 'plan_to_consume') {
    const status = settle(
      (await writeStatuses(supabase, op.userId, [row.id], op.status)).error,
      `Your status on ${label}`,
      notify,
    );
    if (status === 'stop') return status;
  }

  // Somebody may have added the same thing while this device was away.
  const { data: twin } = await supabase
    .from('media_items')
    .select('id')
    .eq('group_id', row.group_id)
    .eq('type', row.type)
    .ilike('title', likeLiteral(row.title))
    .neq('id', row.id)
    .limit(1)
    .maybeSingle();
  if (twin) notify(`${label} may already be in this archive — check for a duplicate.`);

  const year = Number(row.metadata.release_year ?? row.metadata.publication_year) || null;
  let work: ExternalWork | null = null;
  try {
    const res = await fetch(
      `/api/external-search?type=${row.type}&q=${encodeURIComponent(row.title)}`,
    );
    if (res.ok) {
      work = confidentMatch(row.title, year, ((await res.json()) as { results: ExternalWork[] }).results);
    }
  } catch {
    // treated as no match
  }

  if (!work) {
    // Edit rebuilds metadata from its form, so linking it there clears the flag.
    const metadata = { ...row.metadata, needs_match: true };
    await supabase.from('media_items').update({ metadata }).eq('id', row.id);
    report.updated.push({ id: row.id, metadata });
    notify(`${label} synced without details — open it and use Edit to link the right one.`);
    return 'ok';
  }

  let details: {
    metadata?: Record<string, unknown> | null;
    genre?: string | null;
    image_url?: string | null;
  } = {};
  try {
    const res = await fetch(`/api/external-details?id=${encodeURIComponent(work.external_id)}`);
    if (res.ok) details = await res.json();
  } catch {
    // the search result alone is still a link
  }

  // Merged the way the archive import does it: provider data wins, what was
  // typed offline fills the gaps. Tags typed offline are kept alongside.
  const patch = {
    title: work.title,
    genre: serializeTags(parseTags(`${row.genre ?? ''},${details.genre || work.genre || ''}`)) || null,
    metadata: {
      ...row.metadata,
      ...((work.metadata as Record<string, unknown>) ?? {}),
      ...(details.metadata ?? {}),
    },
    external_id: work.external_id,
    external_source: work.external_source,
    external_url: work.external_url,
    image_url: safeImageUrl(details.image_url) ?? safeImageUrl(work.image_url),
  };
  const { error } = await supabase.from('media_items').update(patch).eq('id', row.id);
  if (error) {
    // Most often: the group already has this exact work linked elsewhere.
    notify(`${label} synced, but its details could not be added — use Edit to link it.`);
  } else {
    report.updated.push({ id: row.id, ...patch });
  }
  return 'ok';
}

// --- This device ----------------------------------------------------------

const GROUPS_KEY = 'offline-groups';
const SEEN_KEY = 'offline-seen:';
const CACHE_PREFIX = 'fa-';

function readGroups(): string[] {
  try {
    return JSON.parse(localStorage.getItem(GROUPS_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export function isOfflineGroup(groupId: string): boolean {
  return readGroups().includes(groupId);
}

/** When this device last saw the group online — how old the offline copy is. */
export function lastSeenOnline(groupId: string): string | null {
  try {
    return localStorage.getItem(SEEN_KEY + groupId);
  } catch {
    return null;
  }
}

export function markSeenOnline(groupId: string) {
  try {
    localStorage.setItem(SEEN_KEY + groupId, new Date().toISOString());
  } catch {
    // storage blocked: the badge just won't say how old the copy is
  }
}

export async function registerWorker() {
  if (!('serviceWorker' in navigator)) return false;
  await navigator.serviceWorker.register('/sw.js');
  return true;
}

/**
 * Turns offline use of one group on or off for THIS device.
 *
 * On: the worker is registered and the page that is open right now is copied
 * in, scripts included — they loaded before the worker existed, so it never
 * saw them go by. Off for the last group: the worker and its copies go.
 */
export async function setOfflineGroup(groupId: string, on: boolean) {
  const groups = readGroups().filter((id) => id !== groupId);
  if (on) groups.push(groupId);
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));

  if (on) {
    if (!(await registerWorker())) return;
    await navigator.serviceWorker.ready;
    const scripts = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => url.includes('/_next/static/'));
    const cache = await caches.open(`${CACHE_PREFIX}static`);
    await Promise.allSettled(scripts.map((url) => cache.add(url)));
    // Through the worker, which keeps the answer.
    await fetch(`/groups/${groupId}`).catch(() => null);
    markSeenOnline(groupId);
    return;
  }

  if (groups.length === 0) await dropWorker();
}

async function dropWorker() {
  if ('serviceWorker' in navigator) {
    for (const registration of await navigator.serviceWorker.getRegistrations()) {
      await registration.unregister();
    }
  }
  if ('caches' in window) {
    for (const key of await caches.keys()) {
      if (key.startsWith(CACHE_PREFIX)) await caches.delete(key);
    }
  }
}

/**
 * Everything this device kept, gone — for signing out, so the next person on
 * the device gets neither the archive nor somebody else's unsent changes.
 */
export async function clearOffline() {
  try {
    localStorage.removeItem(GROUPS_KEY);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(SEEN_KEY)) localStorage.removeItem(key);
    }
  } catch {
    // nothing stored
  }
  await dropWorker();
  await new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = request.onerror = request.onblocked = resolve;
  });
  pending = 0;
  emit();
}
