import { cn } from '@/lib/utils';

interface FormBannerProps {
  message: string;
  variant?: 'error' | 'success' | 'info';
  className?: string;
}

export function FormBanner({ message, variant = 'error', className }: FormBannerProps) {
  const styles = {
    error:
      'border-[color-mix(in_srgb,var(--color-destructive)_45%,black_55%)] bg-[color-mix(in_srgb,var(--color-destructive)_14%,black_86%)] text-red-100',
    success:
      'border-[color-mix(in_srgb,var(--color-success)_45%,black_55%)] bg-[color-mix(in_srgb,var(--color-success)_14%,black_86%)] text-emerald-100',
    info:
      'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]',
  } as const;

  return (
    <p
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'animate-fade-in rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-mono',
        styles[variant],
        className
      )}
    >
      {message}
    </p>
  );
}
