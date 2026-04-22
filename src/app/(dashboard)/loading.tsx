import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-[1440px] space-y-8 pb-8">
      <div className="overflow-hidden rounded-[36px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,420px)]">
          <div className="space-y-6">
            <Skeleton className="h-6 w-36 rounded-full" />
            <div className="space-y-3">
              <Skeleton className="h-12 w-full max-w-3xl" />
              <Skeleton className="h-5 w-full max-w-2xl" />
              <Skeleton className="h-5 w-full max-w-xl" />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5"
                >
                  <Skeleton className="h-10 w-10 rounded-2xl" />
                  <Skeleton className="mt-4 h-4 w-32" />
                  <Skeleton className="mt-3 h-16 w-full" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-slate-50/60 p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-3 h-8 w-40" />
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="rounded-[24px] border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-3">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-8 w-20" />
                    </div>
                    <Skeleton className="h-10 w-10 rounded-2xl" />
                  </div>
                  <Skeleton className="mt-3 h-4 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-10 rounded-2xl" />
            </div>
            <Skeleton className="mt-5 h-9 w-24" />
            <Skeleton className="mt-4 h-4 w-32" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,1fr)]">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-80" />
            </div>
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
              >
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-8 w-20" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-6 h-[320px] w-full rounded-3xl" />
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="mt-6 h-[250px] w-full rounded-3xl" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-full space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-4" />
                </div>
                <Skeleton className="mt-3 h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
