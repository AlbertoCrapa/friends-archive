import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingGroupDetail() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="space-y-3 border border-stone-800/50 p-4">
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-11 w-28" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-stone-800/50 pt-3 first:border-t-0 first:pt-0">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
