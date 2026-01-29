import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, type = 'text', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(
            'w-full px-4 py-3 min-h-[48px] rounded-xl bg-[var(--white)] text-[var(--text)] text-[17px]',
            'border-none outline-none transition-colors',
            'placeholder:text-[var(--text-secondary)]',
            'focus:bg-[var(--bg)]',
            error && 'ring-2 ring-[var(--danger)]',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-[var(--danger)]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
