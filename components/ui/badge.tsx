'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
 'inline-flex h-[22px] items-center gap-1 rounded-[var(--radius-sm)] border px-2 text-[11.5px] font-medium leading-none transition-colors focus:outline-none focus:ring-1 focus:ring-stone-50/60 [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-amber-500/15 text-amber-300 hover:bg-amber-500/25',
        secondary: 'border-transparent bg-stone-700 text-stone-200 hover:bg-stone-600',
        destructive: 'border-transparent bg-red-500/15 text-red-300 hover:bg-red-500/25',
        outline: 'border-stone-700 text-stone-300 hover:bg-stone-800',
        tag: 'cursor-pointer border-transparent bg-stone-800 text-stone-300 hover:bg-stone-700',
        public: 'border-transparent bg-emerald-500/15 text-emerald-300',
        private: 'border-transparent bg-stone-800 text-stone-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
