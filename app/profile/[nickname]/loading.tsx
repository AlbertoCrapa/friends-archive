import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingProfile() {
  return (
    <div className="max-w-2xl space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-4 w-48" />
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="border border-stone-800/50 p-4 space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
