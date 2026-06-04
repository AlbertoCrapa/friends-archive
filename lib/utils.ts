import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with clsx — the canonical way to compose class names.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format an ISO date string for display.
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format an ISO date string as a relative time (e.g. "3 days ago").
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Truncate a string to a maximum length, appending an ellipsis if truncated.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '…';
}

/**
 * Returns Tailwind colour classes for a given item status value.
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    plan_to_consume: 'bg-amber-900/30 text-amber-300 border-amber-700/50',
    consuming: 'bg-sky-900/30 text-sky-300 border-sky-700/50',
    completed: 'bg-emerald-900/30 text-emerald-300 border-emerald-700/50',
    // Legacy string values — kept for graceful degradation during migration
    'Plan to Watch': 'bg-amber-900/30 text-amber-300 border-amber-700/50',
    Watching: 'bg-sky-900/30 text-sky-300 border-sky-700/50',
    Watched: 'bg-emerald-900/30 text-emerald-300 border-emerald-700/50',
    'Plan to Read': 'bg-amber-900/30 text-amber-300 border-amber-700/50',
    Reading: 'bg-sky-900/30 text-sky-300 border-sky-700/50',
    Read: 'bg-emerald-900/30 text-emerald-300 border-emerald-700/50',
  };
  return colors[status] ?? 'bg-stone-800/30 text-stone-400 border-stone-700/50';
}
