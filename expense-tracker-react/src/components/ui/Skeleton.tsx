import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('skeleton rounded', className)} />
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
