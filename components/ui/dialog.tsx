'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-[var(--z-modal)] bg-black/75 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-[calc(var(--z-modal)+1)] grid w-[calc(100%-1.5rem)] max-w-xl translate-x-[-50%] translate-y-[-50%] gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-5 shadow-[var(--shadow-3)] duration-[var(--duration-standard)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 max-sm:left-0 max-sm:top-0 max-sm:h-dvh max-sm:w-stretch max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-x-0 max-sm:border-t-0 sm:p-6',
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-[var(--radius-sm)] p-1 opacity-80 transition-opacity duration-[var(--duration-fast)] hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:pointer-events-none">
        <X className="h-4 w-4 text-[var(--color-text-secondary)]" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

/* ---------------------------------------------------------------------------
 * The sheet shape.
 *
 * A form dialog grows: pick "TV Series" and four more fields appear, link a
 * work and a poster block appears with them. Centred and vertically centred,
 * that growth pushes the submit button off the bottom of a phone with nothing
 * to scroll it back — the content box is as tall as its content and the
 * viewport simply clips it.
 *
 * So on a phone these are shaped like the item sheet instead: pulled up from
 * the bottom edge, stopped short of the top, thrown back down by the grab bar,
 * and built as a COLUMN — [grab bar][header][scrolling body][footer] — so the
 * body takes the overflow and the action bar stays on screen at every height
 * the form can reach. On a desk it is the same centred panel it always was.
 *
 * The shell owns no padding; the three parts below do, which is what lets the
 * body scroll under a header and footer that do not move.
 * ------------------------------------------------------------------------- */

const DialogSheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /**
     * The same value driving <Dialog open>. Radix unmounts closed content, and
     * an exit animation needs it kept around one beat longer — so the sheet is
     * force-mounted and AnimatePresence owns the leaving.
     */
    open: boolean;
    /** Closes the sheet when it is thrown back down. */
    onDismiss?: () => void;
  }
>(({ className, children, open, onDismiss, ...props }, ref) => {
  const reduced = useReducedMotion();
  const dragControls = useDragControls();

  // Measured, not guessed: the phone shape is dragged and the desk shape is
  // not, and a drag cannot be wired by a media query alone.
  const [narrow, setNarrow] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return (
    <AnimatePresence>
      {open ? (
        <DialogPortal forceMount>
          <DialogPrimitive.Overlay asChild forceMount>
            <motion.div
              className="fixed inset-0 z-[var(--z-modal)] bg-black/70 backdrop-blur-[3px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            />
          </DialogPrimitive.Overlay>

          <DialogPrimitive.Content ref={ref} asChild forceMount {...props}>
            <motion.div
              className={cn(
                'fixed z-[calc(var(--z-modal)+1)] flex flex-col overflow-hidden border border-white/[0.09] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-3)]',
                // Phone: the bottom edge, never quite full height.
                'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[20px] border-b-0',
                // Desk: a centred panel, capped so a long form scrolls inside
                // it rather than running past the top and bottom of the window.
                'md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[min(86vh,780px)] md:w-[min(30rem,calc(100vw-4rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[var(--radius-lg)] md:border-b',
                className
              )}
              initial={reduced ? { opacity: 0 } : narrow ? { y: '100%' } : { opacity: 0, scale: 0.97, y: 8 }}
              animate={reduced ? { opacity: 1 } : narrow ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : narrow ? { y: '100%' } : { opacity: 0, scale: 0.98 }}
              transition={
                narrow
                  ? { type: 'spring', stiffness: 460, damping: 44, mass: 0.9 }
                  : { duration: 0.26, ease: [0.23, 1, 0.32, 1] }
              }
              // Bound to the grab bar only — a sheet that drags from anywhere
              // fights its own scrolling, and loses to whichever you did not mean.
              drag={narrow ? 'y' : false}
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.02, bottom: 0.55 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 700) onDismiss?.();
              }}
            >
              {narrow ? (
                <div
                  onPointerDown={(event) => dragControls.start(event)}
                  className="flex shrink-0 cursor-grab touch-none justify-center py-2.5 active:cursor-grabbing"
                  aria-hidden
                >
                  <span className="h-1 w-10 rounded-full bg-white/20" />
                </div>
              ) : null}
              {children}
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPortal>
      ) : null}
    </AnimatePresence>
  );
});
DialogSheetContent.displayName = 'DialogSheetContent';

/** Title bar. Stays put while the body scrolls under it. */
const DialogSheetHeader = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4 pb-3 pt-1 md:px-6 md:pb-4 md:pt-5',
      className
    )}
    {...props}
  >
    <div className="min-w-0">{children}</div>
    <DialogPrimitive.Close className="-mr-1 shrink-0 rounded-[var(--radius-sm)] p-2 opacity-80 transition-opacity duration-[var(--duration-fast)] hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:pointer-events-none">
      <X className="h-4 w-4 text-[var(--color-text-secondary)]" />
      <span className="sr-only">Close</span>
    </DialogPrimitive.Close>
  </div>
);
DialogSheetHeader.displayName = 'DialogSheetHeader';

/** The one part that scrolls. Everything that can grow belongs in here. */
const DialogSheetBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6',
      className
    )}
    {...props}
  />
);
DialogSheetBody.displayName = 'DialogSheetBody';

/**
 * The action bar, pinned to the bottom of the sheet — clear of the home
 * indicator, which is the one part of a phone screen a button must not sit on.
 */
const DialogSheetFooter = ({
  className,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex shrink-0 flex-col-reverse gap-2 border-t border-white/[0.06] bg-stone-950/40 px-4 pt-3 md:flex-row md:items-center md:justify-end md:px-6',
      className
    )}
    style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))', ...style }}
    {...props}
  />
);
DialogSheetFooter.displayName = 'DialogSheetFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-serif font-semibold leading-none tracking-tight text-[var(--color-text-primary)]', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-[var(--color-text-secondary)] font-mono', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogSheetContent,
  DialogSheetHeader,
  DialogSheetBody,
  DialogSheetFooter,
  DialogTitle,
  DialogDescription,
};
