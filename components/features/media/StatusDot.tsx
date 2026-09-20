'use client';

import { cn } from '@/lib/utils';
import { getStatusLabel } from '@/types';
import type { ItemStatus } from '@/types';

/**
 * What each state looks like, defined once.
 *
 * Planned is neutral because it is the default and carries no news. In progress
 * is the accent, because it is the only state that is going anywhere. Finished
 * is the one positive in the palette. Opted out is the quietest thing on the
 * page, one step above the surface, because it is a row you have asked to stop
 * thinking about.
 *
 * These four readings hold wherever a status appears — a list row, a grid card,
 * a filter, and the menus you change them from — so the colour is learnt once.
 */
export const STATUS_DOT: Record<ItemStatus, string> = {
  plan_to_consume: 'bg-stone-400',
  consuming: 'bg-amber-400',
  completed: 'bg-emerald-500',
  not_interested: 'bg-stone-600',
};

export function StatusDot({ status, className }: { status: ItemStatus; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('h-[7px] w-[7px] shrink-0 rounded-full', STATUS_DOT[status], className)}
    />
  );
}

/** Status options for a GlideSelect, each carrying its own dot. */
export function statusOptions(values: { value: ItemStatus; label: string }[]) {
  return values.map((option) => ({
    value: option.value,
    label: option.label,
    icon: <StatusDot status={option.value} />,
  }));
}

/** The same list for a filter, with an "any" row that has no colour to claim. */
export function statusFilterOptions(anyLabel: string) {
  const statuses: ItemStatus[] = ['plan_to_consume', 'consuming', 'completed', 'not_interested'];
  return [
    { value: 'all', label: anyLabel },
    ...statuses.map((status) => ({
      value: status,
      label: getStatusLabel(status),
      icon: <StatusDot status={status} />,
    })),
  ];
}
