import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('skeleton rounded', className)} />
  );
}

// Standardized loading spinner used across the app
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-5 h-5 border',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-3'
  };
  
  return (
    <div 
      className={cn(
        sizeClasses[size],
        'border-[var(--teal-green)] border-t-transparent rounded-full animate-spin',
        className
      )} 
    />
  );
}

// Full page loading state
interface PageLoadingProps {
  message?: string;
}

export function PageLoading({ message }: PageLoadingProps) {
  return (
    <div className="h-full bg-[var(--bg)] safe-top flex flex-col items-center justify-center gap-4">
      <LoadingSpinner size="lg" />
      {message && (
        <p className="text-[var(--text-secondary)] text-sm">{message}</p>
      )}
    </div>
  );
}

export function ExpenseItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 bg-[var(--white)]">
      <Skeleton className="w-11 h-11 rounded-xl" />
      <div className="flex-1">
        <Skeleton className="w-32 h-4 mb-2" />
        <Skeleton className="w-24 h-3" />
      </div>
      <Skeleton className="w-16 h-4" />
    </div>
  );
}

export function ExpenseListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-[var(--border)]">
      {Array.from({ length: count }).map((_, i) => (
        <ExpenseItemSkeleton key={i} />
      ))}
    </div>
  );
}

// Person item skeleton
export function PersonItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 bg-[var(--white)]">
      <Skeleton className="w-10 h-10 rounded-full" />
      <Skeleton className="w-24 h-4" />
    </div>
  );
}

// Stats card skeleton
export function StatsCardSkeleton() {
  return (
    <div className="bg-[var(--white)] rounded-xl p-4">
      <Skeleton className="w-20 h-3 mb-2" />
      <Skeleton className="w-28 h-6" />
    </div>
  );
}
