'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
 'ui-touch inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] text-[13px] font-semibold tracking-[-0.01em] transition-[background-color,color,opacity,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-50/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)] disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-stone-50 text-stone-900 hover:bg-white',
        primary: 'bg-stone-50 text-stone-900 hover:bg-white',
        destructive: 'bg-[var(--color-destructive)] text-white hover:brightness-110',
        outline:
 'border border-stone-700 bg-transparent text-stone-200 hover:bg-stone-800 hover:text-stone-50',
        secondary: 'bg-stone-800 text-stone-100 hover:bg-stone-700',
        ghost: 'bg-transparent text-stone-400 hover:bg-stone-800 hover:text-stone-50',
        link: 'h-auto px-0 py-0 text-stone-100 underline underline-offset-4 decoration-stone-600 hover:decoration-stone-100',
      },
      size: {
        default: 'h-9 px-3.5',
        sm: 'h-8 rounded-[var(--radius-sm)] px-3 text-[12.5px]',
        lg: 'h-11 px-5 text-sm',
        icon: 'h-9 w-9 px-0',
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
