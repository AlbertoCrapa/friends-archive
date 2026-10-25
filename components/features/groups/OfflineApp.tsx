'use client';

import { useEffect, useState } from 'react';
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

/**
 * What makes a group page installable as its own app. React hoists these into
 * <head>, so both the archive and its settings page can carry them.
 */
export function GroupAppLinks({ groupId, groupName }: { groupId: string; groupName: string }) {
  return (
    <>
      <link
        rel="manifest"
        href={`/groups/${groupId}/manifest.webmanifest?name=${encodeURIComponent(groupName)}`}
      />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-title" content={groupName} />
    </>
  );
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
              ? 'To put it on your home screen: open this group in Safari, tap Share, then Add to Home Screen.'
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
 */
export function OfflineBadge({
  groupId,
  onSynced,
}: {
  groupId: string;
  onSynced: (updated: SyncReport['updated']) => void;
}) {
  const { toast } = useToast();
  const offline = useOffline();
  const waiting = usePendingCount();
  const [seen, setSeen] = useState<string | null>(null);

  // Online: this visit is the freshest copy. An app opened from the home screen
  // on iOS has its own storage, separate from Safari's, so the switch flipped
  // in Safari is not visible here: being installed IS the switch.
  useEffect(() => {
    setSeen(lastSeenOnline(groupId));
    if (isOffline()) return;
    markSeenOnline(groupId);
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
      if (report.updated.length > 0) onSynced(report.updated);
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
