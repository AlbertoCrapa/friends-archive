'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
 'flex h-10 w-full cursor-text rounded-[var(--radius-md)] border border-stone-700 bg-stone-800/60 px-3 text-sm text-stone-50 placeholder:text-stone-500 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-50/25 disabled:cursor-not-allowed disabled:opacity-50 transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)]',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
