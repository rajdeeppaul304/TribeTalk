export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-lg bg-white/10 ${className}`} />
}

export function MessageSkeleton() {
  return <div className="flex gap-3 px-4 py-3"><Skeleton className="h-9 w-9 shrink-0 rounded-full"/><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-3 w-32"/><Skeleton className="h-4 w-3/4"/><Skeleton className="h-4 w-1/2"/></div></div>
}
