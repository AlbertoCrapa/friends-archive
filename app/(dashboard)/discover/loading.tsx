import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingDiscover() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="border border-stone-800/50 p-5 space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="flex items-center justify-between pt-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
