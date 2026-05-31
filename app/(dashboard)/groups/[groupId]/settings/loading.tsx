import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingGroupSettings() {
  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="space-y-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-40" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-4 w-20" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="border border-stone-800/50 p-3">
            <Skeleton className="h-4 w-2/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
