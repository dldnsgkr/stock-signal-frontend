export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-6 w-24 rounded bg-muted animate-pulse" />
        <div className="mt-1 h-4 w-56 rounded bg-muted animate-pulse" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
            <div className="h-3 w-24 rounded bg-muted animate-pulse" />
            <div className="h-7 w-16 rounded bg-muted animate-pulse" />
            <div className="h-3 w-20 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card">
          <div className="border-b px-6 py-4">
            <div className="h-5 w-40 rounded bg-muted animate-pulse" />
          </div>
          <div className="p-6 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-4 space-y-2">
                <div className="flex justify-between">
                  <div className="h-4 w-16 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-12 rounded bg-muted animate-pulse" />
                </div>
                <div className="h-3 w-32 rounded bg-muted animate-pulse" />
                <div className="h-3 w-48 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b px-6 py-4">
            <div className="h-5 w-24 rounded bg-muted animate-pulse" />
          </div>
          <div className="p-6 space-y-3">
            <div className="h-10 rounded-md bg-muted animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-20 rounded-md bg-muted animate-pulse" />
              <div className="h-20 rounded-md bg-muted animate-pulse" />
            </div>
            <div className="h-16 rounded-md bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
