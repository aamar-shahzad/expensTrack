import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, icon, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-full transition-all duration-150 touch-manipulation select-none disabled:opacity-40 disabled:pointer-events-none active:scale-[0.97]';
    
    const variants = {
      primary: 'bg-[var(--teal-green)] text-white hover:opacity-90',
      secondary: 'bg-transparent text-[var(--teal-green)] border-[1.5px] border-[var(--teal-green)] hover:bg-[var(--teal-green)]/10',
      danger: 'bg-[var(--danger)] text-white hover:opacity-90',
      ghost: 'bg-transparent text-[var(--text)] hover:bg-[var(--border)]'
    };
    
    const sizes = {
      sm: 'px-4 py-2 text-sm min-h-[36px]',
      md: 'px-5 py-3 text-base min-h-[48px]',
      lg: 'px-6 py-4 text-lg min-h-[56px]'
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
        ) : icon ? (
          <span className="mr-2">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
