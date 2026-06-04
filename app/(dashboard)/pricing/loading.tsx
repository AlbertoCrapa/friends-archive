import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingPricing() {
  return (
    <div className="space-y-20 max-w-5xl">
      <div className="space-y-4 pt-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-14 w-64" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <div className="border border-stone-800/50 grid grid-cols-1 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-8 space-y-6 border-b sm:border-b-0 sm:border-r border-stone-800/50 last:border-r-0">
            <div className="space-y-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-12 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <Skeleton className="h-3 w-32" />
        <div className="border border-stone-800/50">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid border-b border-stone-800/30 last:border-b-0" style={{ gridTemplateColumns: '1fr repeat(3, 120px)' }}>
              <div className="px-4 py-4 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              {[0,1,2].map((j) => (
                <div key={j} className="px-4 py-4 flex justify-center items-center border-l border-stone-800/30">
                  <Skeleton className="h-4 w-8" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
