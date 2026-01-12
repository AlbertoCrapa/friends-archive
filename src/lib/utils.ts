import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Generate a simple ID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Get status color class
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'Plan to Watch': 'bg-amber-900/30 text-amber-200 border-amber-700/50',
    'Watching': 'bg-emerald-900/30 text-emerald-200 border-emerald-700/50',
    'Watched': 'bg-stone-700/30 text-stone-300 border-stone-600/50',
    'Plan to Read': 'bg-amber-900/30 text-amber-200 border-amber-700/50',
    'Reading': 'bg-emerald-900/30 text-emerald-200 border-emerald-700/50',
    'Read': 'bg-stone-700/30 text-stone-300 border-stone-600/50',
  };
  return colors[status] || 'bg-stone-800 text-stone-400';
}
