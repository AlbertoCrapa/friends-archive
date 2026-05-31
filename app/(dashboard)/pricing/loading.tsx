import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingPricing() {
  return (
    <div className="space-y-10 max-w-4xl">
      <div className="space-y-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-52" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="border border-stone-800/50 p-6 space-y-6">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-24" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
