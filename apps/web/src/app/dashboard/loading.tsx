export default function DashboardLoading() {
  return (
    <div className="flex-1 px-3 pb-4 pt-5 sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-[1460px] flex-col gap-4">
        {/* Heading skeleton */}
        <section className="px-2 sm:px-1">
          <div className="h-8 w-36 animate-pulse rounded-lg bg-slate-200" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-slate-100" />
        </section>

        {/* KPI cards skeleton */}
        <section className="grid gap-4 xl:grid-cols-6 px-2 sm:px-1">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-7 w-12 animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </section>

        {/* Content area skeleton */}
        <section className="grid gap-4 lg:grid-cols-2 px-2 sm:px-1">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
            <div className="mt-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-50" />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
            <div className="mt-4 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-50" />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
