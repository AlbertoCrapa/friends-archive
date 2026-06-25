import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

interface PageLoaderProps {
  label?: string;
  className?: string;
}

/** Classic centered page loader, used by route loading states. */
export function PageLoader({ label = 'Loading', className }: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('flex flex-col items-center justify-center gap-4 py-32', className)}
    >
      <Spinner className="h-8 w-8 text-[var(--color-accent)]" />
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-stone-600">
        {label}
      </span>
    </div>
  );
}
