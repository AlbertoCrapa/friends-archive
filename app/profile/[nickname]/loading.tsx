import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingProfile() {
  return (
    <div className="max-w-2xl space-y-12">
      {/* Back nav */}
      <Skeleton className="h-10 w-28" />

      {/* Profile header */}
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-12 w-56" />
          <Skeleton className="h-3 w-44" />
        </div>
        {/* Stats row */}
        <div className="flex items-stretch border border-stone-800/50 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex-1 px-5 py-4 space-y-2 border-r border-stone-800/50 last:border-r-0"
            >
              <Skeleton className="h-7 w-10" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Archives list */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-36" />
        </div>
        <div className="border border-stone-800/50">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="border-b border-stone-800/30 last:border-b-0 px-5 py-4 flex items-start justify-between gap-4"
            >
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-14 shrink-0" />
                </div>
                <Skeleton className="h-3.5 w-3/4" />
              </div>
              <div className="shrink-0 text-right space-y-1.5">
                <Skeleton className="h-3 w-12 ml-auto" />
                <Skeleton className="h-2.5 w-10 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

