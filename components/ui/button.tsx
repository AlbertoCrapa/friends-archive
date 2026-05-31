'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-[var(--duration-standard)] ease-[var(--ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)] disabled:pointer-events-none disabled:opacity-55 disabled:cursor-not-allowed font-mono uppercase tracking-wider',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--color-accent)] text-[var(--color-background)] hover:bg-[var(--color-accent-hover)] shadow-[var(--shadow-1)]',
        primary:
          'bg-[var(--color-accent)] text-[var(--color-background)] hover:bg-[var(--color-accent-hover)] shadow-[var(--shadow-1)]',
        destructive:
          'bg-[color-mix(in_srgb,var(--color-destructive)_22%,black_78%)] text-red-100 hover:bg-[color-mix(in_srgb,var(--color-destructive)_34%,black_66%)] border border-[color-mix(in_srgb,var(--color-destructive)_40%,black_60%)]',
        outline:
          'border border-[var(--color-border)] bg-transparent hover:bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
        secondary:
          'bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] hover:bg-[color-mix(in_srgb,var(--color-surface-elevated)_72%,white_28%)] border border-[var(--color-border)]',
        ghost:
          'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-primary)]',
        link:
          'h-auto px-0 py-0 text-[var(--color-accent)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 px-4 py-2 text-sm',
        sm: 'h-10 px-3 text-xs',
        lg: 'h-12 px-8 text-base',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
