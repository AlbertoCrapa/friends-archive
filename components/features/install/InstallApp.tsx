'use client';

// ============================================================================
// Installing the archive as an app.
//
// Where the browser offers it (Chrome, Edge, Android), one button opens the
// real install prompt that lib/offline.ts has been holding since page load.
// Everywhere else — iPhone, Safari, Firefox — there is no prompt to call, so
// the same button opens the steps for the browser in hand instead of a dead
// control. Every claim in BENEFITS is something the app actually does: the
// manifest starts on /dashboard, sw.js serves the saved copy, offline is per
// group in that group's settings.
// ============================================================================

import { useEffect, useState } from 'react';
import { AppWindow, Check, Download, WifiOff, X, Zap } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { promptInstall, useInstallPrompt } from '@/lib/offline';
import { cn } from '@/lib/utils';

export type Platform = 'chromium' | 'android' | 'ios' | 'safari' | 'firefox';

export const PLATFORM_LABEL: Record<Platform, string> = {
  chromium: 'Chrome / Edge',
  android: 'Android',
  ios: 'iPhone / iPad',
  safari: 'Safari on Mac',
  firefox: 'Firefox',
};

export const INSTALL_STEPS: Record<Platform, string[]> = {
  chromium: ['Click the install icon at the right of the address bar.', 'Or open the ⋮ menu and choose Install The Friend Archive.', 'It opens in its own window, and lives in your dock or Start menu.'],
  android: ['Open this page in Chrome.', 'Tap the ⋮ menu, then Install app or Add to Home screen.', 'The archive appears with your other apps.'],
  ios: ['Open this page in Safari.', 'Tap Share — the square with the arrow.', 'Choose Add to Home Screen, then Add.'],
  safari: ['Use Safari 17 or later on macOS Sonoma.', 'In the menu bar choose File, then Add to Dock.', 'It opens in its own window, like any app.'],
  firefox: ['Firefox on a computer cannot install web apps.', 'Open this page in Chrome or Edge and use the install icon in the address bar.', 'On Android, Firefox can: ⋮ menu, then Install.'],
};

export const BENEFITS = [
  { icon: AppWindow, title: 'Its own window and icon', body: 'No tabs, no address bar. It opens straight on your archives.' },
  { icon: Zap, title: 'Opens instantly', body: 'The last copy shows at once while the live one loads behind it.' },
  { icon: WifiOff, title: 'Works offline', body: 'Turn it on per group in settings; changes sync when you are back.' },
  { icon: Download, title: 'Nothing to download', body: 'No store and no updates to run. Remove it like any other app.' },
];

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  if (/Firefox/.test(ua)) return 'firefox';
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua)) return 'safari';
  return 'chromium';
}

/** `null` until mounted: nothing about installing can be known on the server. */
export function useInstall() {
  const prompt = useInstallPrompt();
  const [env, setEnv] = useState<{ installed: boolean; platform: Platform } | null>(null);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)');
    const read = () =>
      setEnv({
        installed: standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
        platform: detectPlatform(),
      });
    read();
    window.addEventListener('appinstalled', read);
    standalone.addEventListener('change', read);
    return () => {
      window.removeEventListener('appinstalled', read);
      standalone.removeEventListener('change', read);
    };
  }, []);

  return { canPrompt: !!prompt, installed: env?.installed ?? false, platform: env?.platform ?? null };
}

export function InstallSteps({ platform, className }: { platform: Platform; className?: string }) {
  return (
    <ol className={cn('space-y-2.5', className)}>
      {INSTALL_STEPS[platform].map((step, i) => (
        <li key={step} className="flex gap-3 text-[13.5px] leading-[1.5] text-stone-300">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-stone-800 text-[11px] font-semibold tabular-nums text-stone-200">
            {i + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}

/**
 * The one install control. Prompts where the browser can; otherwise opens the
 * steps for this browser. Already installed, it says so and does nothing.
 */
export function InstallButton({ children = 'Install the app', ...props }: ButtonProps) {
  const { canPrompt, installed, platform } = useInstall();
  const [open, setOpen] = useState(false);

  if (installed) {
    return (
      <Button {...props} variant="secondary" disabled>
        <Check /> Installed on this device
      </Button>
    );
  }

  return (
    <>
      <Button {...props} onClick={() => (canPrompt ? void promptInstall() : setOpen(true))}>
        <Download /> {children}
      </Button>
      <InstallDialog open={open} onOpenChange={setOpen} platform={platform ?? 'chromium'} />
    </>
  );
}

export function InstallDialog({ open, onOpenChange, platform }: { open: boolean; onOpenChange: (open: boolean) => void; platform: Platform }) {
  const { canPrompt } = useInstall();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Install The Friend Archive</DialogTitle>
          <DialogDescription>It is a web app: installing it takes a few seconds and nothing is downloaded from a store.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <p className="mb-3 text-[12.5px] font-medium text-stone-400">On {PLATFORM_LABEL[platform]}</p>
            <InstallSteps platform={platform} />
            {canPrompt && (
              <Button className="mt-4" onClick={() => void promptInstall().then(() => onOpenChange(false))}>
                <Download /> Install now
              </Button>
            )}
          </div>

          <ul className="grid gap-3 border-t border-white/[0.07] pt-4 sm:grid-cols-2">
            {BENEFITS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-2.5">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                <span>
                  <span className="block text-[13px] font-semibold text-stone-100">{title}</span>
                  <span className="block text-[12.5px] leading-snug text-stone-400">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const DISMISS_KEY = 'fa-install-card-dismissed';

/**
 * The dashboard's announcement. Shown once per device until installed or
 * dismissed; it never comes back after either.
 */
export function InstallCard() {
  const { canPrompt, installed, platform } = useInstall();
  const [dismissed, setDismissed] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!platform || installed || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Private mode: it simply shows again next time.
    }
  };

  return (
    <section className="relative flex flex-col gap-4 overflow-hidden rounded-[var(--radius-lg)] border border-amber-500/25 bg-stone-900 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(60% 120% at 0% 0%, rgba(44,153,248,0.12), transparent 60%)' }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" className="relative h-12 w-12 shrink-0 rounded-[12px] shadow-[var(--shadow-2)]" />
      <div className="relative min-w-0 flex-1 pr-8 sm:pr-0">
        <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold tracking-[-0.015em] text-stone-50">
          <span className="rounded-[var(--radius-sm)] bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300">New</span>
          Install the archive as an app
        </p>
        <p className="mt-1 text-[13px] leading-snug text-stone-400">
          Its own window and icon, opens instantly, and works offline for the groups you choose.
        </p>
      </div>
      <div className="relative flex shrink-0 items-center gap-2">
        <Button size="sm" onClick={() => (canPrompt ? void promptInstall() : setOpen(true))}>
          <Download /> Install
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          How it works
        </Button>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] text-stone-400 hover:bg-stone-800 hover:text-stone-100"
      >
        <X className="h-4 w-4" />
      </button>
      <InstallDialog open={open} onOpenChange={setOpen} platform={platform} />
    </section>
  );
}
