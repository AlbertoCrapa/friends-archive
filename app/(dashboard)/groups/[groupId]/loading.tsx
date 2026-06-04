import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingGroupDetail() {
  return (
    <div className="space-y-8">
      {/* Group header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3 min-w-0">
          <Skeleton className="h-7 w-24" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-72 max-w-full" />
            <Skeleton className="h-5 w-16 shrink-0" />
          </div>
          <Skeleton className="h-4 w-80 max-w-full" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-10 w-28 shrink-0" />
      </div>

      {/* Filter tabs + add button */}
      <div className="border-b border-stone-900 pb-3 flex items-center justify-between gap-3">
        <div className="flex gap-0 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-24 mr-1" />
          ))}
        </div>
        <Skeleton className="h-10 w-28 shrink-0" />
      </div>

      {/* Table rows */}
      <div className="border border-stone-800/50 space-y-0">
        <div className="hidden md:grid md:grid-cols-[2.2fr_1fr_1fr_1.6fr_1fr_1.4fr_76px] gap-4 px-4 py-3 border-b border-stone-800/60">
          {['40%','20%','20%','30%','25%','25%','10%'].map((_, i) => (
            <Skeleton key={i} className="h-3" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-4 border-b border-stone-800/30 flex flex-col md:grid md:grid-cols-[2.2fr_1fr_1fr_1.6fr_1fr_1.4fr_76px] gap-4 items-start">
            <div className="space-y-1.5 w-full">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-4 w-full max-w-[80px]" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
