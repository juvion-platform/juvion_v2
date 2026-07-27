interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse rounded bg-slate-200/70 ${className}`} aria-hidden="true" />;
}

/**
 * Placeholder for a module hub's KPI banner. Hubs previously rendered
 * `{stats && (...)}`, so the whole band was absent until the API resolved and
 * then shoved the page down — this reserves the space instead.
 */
export function StatBannerSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-14" />
        </div>
      ))}
      <span className="sr-only">Loading summary…</span>
    </div>
  );
}
