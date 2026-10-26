'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import {
  flush,
  isOffline,
  isOfflineGroup,
  lastSeenOnline,
  markSeenOnline,
  probe,
  promptInstall,
  registerWorker,
  setOfflineGroup,
  useInstallPrompt,
  useOffline,
  usePendingCount,
  type SyncReport,
} from '@/lib/offline';

const isStandalone = () =>
  typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;

const REFRESH_KEY = 'fa-refreshed-at';

/**
 * Lives in the signed-in layout, once per app open.
 *
 * Installed, the worker is what makes the app open fast: it hands back the
 * last copy of the page at once (public/sw.js). This is the other half — a
 * page older than a few seconds was that copy, so it asks the server for the
 * live data and swaps it in without a reload.
 *
 * `renderedAt` is stamped by the server; the layout is not re-rendered on
 * in-app navigation, so this runs on a real open, not on every click.
 */
export function InstalledApp({ renderedAt }: { renderedAt: number }) {
  const router = useRouter();

  useEffect(() => {
    if (isStandalone()) void registerWorker();
    if (isOffline() || Date.now() - renderedAt < 10_000) return;
    // A refresh that cannot reach the server makes Next reload the page — which
    // the worker answers with the same copy. Once a half minute, so a weak
    // signal cannot turn that into a loop.
    try {
      const last = Number(sessionStorage.getItem(REFRESH_KEY) ?? 0);
      if (Date.now() - last < 30_000) return;
      sessionStorage.setItem(REFRESH_KEY, String(Date.now()));
    } catch {
      // no storage: refresh anyway, the worst case is one extra round trip
    }
    router.refresh();
    // Once per open: renderedAt from the refresh is fresh by definition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/**
 * The per-device switch, in group settings. Per DEVICE, not per account: the
 * copy lives in this browser, and a phone and a laptop are two decisions.
 */
export function OfflineAppSetting({ groupId }: { groupId: string }) {
  const { toast } = useToast();
  const offline = useOffline();
  const installPrompt = useInstallPrompt();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setOn(isOfflineGroup(groupId));
    setInstalled(isStandalone());
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
  }, [groupId]);

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      await setOfflineGroup(groupId, next);
      setOn(next);
    } catch {
      toast({ message: 'This browser would not keep an offline copy. Private windows usually cannot.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border border-stone-800/50 px-5 py-4">
      <label className="flex cursor-pointer items-start gap-3">
        <Checkbox
          checked={on}
          disabled={busy || offline}
          onCheckedChange={(value) => void toggle(value === true)}
          className="mt-0.5"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm text-stone-200">
            Use this group offline on this device
            {busy ? <Spinner className="h-3.5 w-3.5" /> : null}
          </span>
          <span className="mt-1 block text-[12.5px] leading-relaxed text-stone-500">
            Keeps a copy of everything you open here, posters included. Offline you can change
            your own status, rating and notes, comment, and add titles by name — they sync and
            get their details when you are back online.
          </span>
        </span>
      </label>

      {on && !installed ? (
        installPrompt ? (
          <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => void promptInstall()}>
            <Download className="h-3.5 w-3.5" />
            Install as an app
          </Button>
        ) : (
          <p className="text-[12.5px] text-stone-500">
            {ios
              ? 'To put it on your home screen: open the archive in Safari, tap Share, then Add to Home Screen.'
              : "To put it on your home screen, use your browser's menu: Install app or Add to Home screen."}
          </p>
        )
      ) : null}
    </div>
  );
}

/**
 * The offline badge, and the sync that runs behind it.
 *
 * Fixed at the top of the screen so it can never be scrolled away: while it is
 * up, what you see is a saved copy and anything you change is waiting on this
 * device. Online with changes still waiting, it says so until they land.
 *
 * Without a group it is the dashboard's: same badge, same sync, and the copy's
 * age kept under its own key.
 */
export function OfflineBadge({
  groupId,
  onSynced,
}: {
  groupId?: string;
  onSynced?: (updated: SyncReport['updated']) => void;
}) {
  const { toast } = useToast();
  const offline = useOffline();
  const waiting = usePendingCount();
  const [seen, setSeen] = useState<string | null>(null);

  // Online: this visit is the freshest copy. An app opened from the home screen
  // on iOS has its own storage, separate from Safari's, so the switch flipped
  // in Safari is not visible here: being installed IS the switch.
  useEffect(() => {
    setSeen(lastSeenOnline(groupId ?? 'dashboard'));
    if (isOffline()) return;
    markSeenOnline(groupId ?? 'dashboard');
    if (!groupId) return; // the worker itself is InstalledApp's job
    if (isOfflineGroup(groupId)) void registerWorker();
    else if (isStandalone()) void setOfflineGroup(groupId, true).catch(() => null);
  }, [groupId]);

  // Sync on the way back online, and every half minute after that: a write
  // that died on the wire forces offline without the browser noticing, and the
  // probe is what notices it coming back.
  useEffect(() => {
    let alive = true;
    const notify = (message: string) => toast({ message, tone: 'destructive', durationMs: 9000 });
    const tick = async () => {
      await probe();
      if (isOffline()) return;
      const report = await flush(notify);
      if (!alive) return;
      if (report.updated.length > 0) onSynced?.(report.updated);
      if (report.processed > 0) {
        toast({
          tone: 'success',
          message: `Synced ${report.processed} offline change${report.processed === 1 ? '' : 's'}.`,
        });
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 30000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
    // onSynced is a fresh closure every render; the sync only follows the connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline, toast]);

  if (!offline && waiting === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ top: 'calc(0.5rem + env(safe-area-inset-top, 0px))' }}
      className="fixed left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-amber-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-stone-950 shadow-[var(--shadow-3)]"
    >
      {offline ? (
        <>
          <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            Offline
            {waiting > 0 ? ` · ${waiting} waiting to sync` : ''}
            {seen
              ? ` · saved ${new Date(seen).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`
              : ''}
          </span>
        </>
      ) : (
        <>
          <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          <span className="truncate">Syncing {waiting} offline change{waiting === 1 ? '' : 's'}…</span>
        </>
      )}
    </div>
  );
}
