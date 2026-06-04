import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingDiscover() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="border border-stone-800/50 p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-6 w-3/5" />
              <Skeleton className="h-5 w-16 shrink-0" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-10 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
