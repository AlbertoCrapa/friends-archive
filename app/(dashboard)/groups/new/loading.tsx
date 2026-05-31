import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingNewGroup() {
  return (
    <div className="max-w-lg space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="space-y-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-11 w-full" />
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-11 w-36" />
          <Skeleton className="h-11 w-24" />
        </div>
      </div>
    </div>
  );
}
