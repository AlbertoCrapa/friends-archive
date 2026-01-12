import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center border px-2 py-0.5 text-xs font-mono uppercase tracking-wider transition-colors focus:outline-none focus:ring-1 focus:ring-amber-500',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-amber-600/20 text-amber-300 hover:bg-amber-600/30',
        secondary: 'border-transparent bg-stone-700 text-stone-300 hover:bg-stone-600',
        destructive: 'border-transparent bg-red-900/50 text-red-300 hover:bg-red-900/70',
        outline: 'border-stone-600 text-stone-300 hover:bg-stone-800',
        tag: 'border-stone-600 bg-stone-800/50 text-stone-300 hover:bg-stone-700 cursor-pointer',
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
