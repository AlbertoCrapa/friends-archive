import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500 disabled:pointer-events-none disabled:opacity-50 font-mono uppercase tracking-wider',
  {
    variants: {
      variant: {
        default: 'bg-amber-600 text-stone-950 hover:bg-amber-500 shadow-lg shadow-amber-900/20',
        destructive: 'bg-red-900/50 text-red-200 hover:bg-red-900/70 border border-red-800/50',
        outline: 'border border-stone-700 bg-transparent hover:bg-stone-800 hover:text-stone-100',
        secondary: 'bg-stone-800 text-stone-200 hover:bg-stone-700 border border-stone-700',
        ghost: 'hover:bg-stone-800 hover:text-stone-100',
        link: 'text-amber-500 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-8 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
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
