import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingGroupSettings() {
  return (
    <div className="max-w-2xl space-y-8">
      {/* Back + header */}
      <div className="space-y-3">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-36" />
      </div>

      {/* Group info form */}
      <div className="space-y-5">
        <Skeleton className="h-3 w-20" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-10" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-18" />
          <Skeleton className="h-11 w-full" />
        </div>
        <Skeleton className="h-11 w-36" />
      </div>

      {/* Members section */}
      <div className="space-y-4">
        <Skeleton className="h-3 w-18" />
        <div className="border border-stone-800/50">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3.5 border-b border-stone-800/30 last:border-b-0">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="h-10 w-10" />
            </div>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div className="border border-red-900/30 p-5 space-y-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-11 w-40" />
      </div>
    </div>
  );
}
