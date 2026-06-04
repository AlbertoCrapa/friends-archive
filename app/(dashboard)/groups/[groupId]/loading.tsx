import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingGroupDetail() {
  return (
    <div className="space-y-8">
      {/* Group header skeleton */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <Skeleton className="h-8 w-28 -ml-2" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-56 max-w-full" />
            <Skeleton className="h-5 w-16 shrink-0" />
          </div>
          <Skeleton className="h-4 w-72 max-w-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-9 w-28 shrink-0" />
      </div>

      {/* Media section skeleton */}
      <div className="space-y-0">
        <div className="border-b border-stone-900 flex items-center justify-between gap-3 py-1">
          <div className="flex gap-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-20 mr-1" />
            ))}
          </div>
          <Skeleton className="h-9 w-28 shrink-0" />
        </div>
        <div className="flex items-center gap-2 py-2.5">
          <Skeleton className="h-9 w-64" />
          <div className="flex gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-20" />
            ))}
          </div>
        </div>
        <div className="border border-stone-800/50 mt-4">
          <div className="hidden md:grid md:grid-cols-[2.2fr_1fr_1fr_1.6fr_1fr_1.4fr_76px] gap-4 px-4 py-3 border-b border-stone-800/60">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-3" />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-4 border-b border-stone-800/30 hidden md:grid md:grid-cols-[2.2fr_1fr_1fr_1.6fr_1fr_1.4fr_76px] gap-4 items-start">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-2/5" />
              </div>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-7 ml-auto" />
            </div>
          ))}
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`m${i}`} className="md:hidden p-4 border-b border-stone-800/30 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
