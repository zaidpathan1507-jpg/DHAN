export default function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-lg bg-surface-muted ${className}`} />;
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="card p-5 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}
