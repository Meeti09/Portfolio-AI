interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-lg bg-dark-border relative overflow-hidden ${className}`}
      style={{
        backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
        backgroundSize: '600px 100%',
        animation: 'shimmer 1.8s infinite linear',
      }}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="card rounded-xl p-6 flex flex-col gap-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-2/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-10 w-full mt-auto" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3.5 border-b border-dark-border">
      <Skeleton className="h-8 w-8 rounded-md" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
  )
}