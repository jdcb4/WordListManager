import { useMemo, useState } from "react";

import { Button } from "../ui/button";
import { useJobTracker } from "../../lib/job-tracker";

function statusTone(status) {
  if (status === "running") return "text-sky-700";
  if (status === "success") return "text-emerald-700";
  if (status === "error") return "text-red-700";
  return "text-muted-foreground";
}

export function CurrentJobsPanel() {
  const [open, setOpen] = useState(false);
  const { jobs, runningCount, dismissJob, clearFinishedJobs } = useJobTracker();
  const visibleJobs = useMemo(() => jobs.slice(0, 8), [jobs]);

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-40 flex w-[360px] max-w-[calc(100vw-1.5rem)] flex-col gap-2">
      <div className="pointer-events-auto rounded-xl border border-border bg-card p-2 shadow-lg">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
        >
          <span className="font-semibold">Current Jobs</span>
          <span className="text-xs text-muted-foreground">
            {runningCount} running / {jobs.length} tracked
          </span>
        </button>
        {open ? (
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" onClick={clearFinishedJobs}>
                Clear finished
              </Button>
            </div>
            {!visibleJobs.length ? (
              <div className="rounded-lg border border-border bg-muted px-3 py-3 text-sm text-muted-foreground">
                No jobs tracked yet.
              </div>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {visibleJobs.map((job) => (
                  <div key={job.id} className="rounded-lg border border-border bg-white px-3 py-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{job.title}</div>
                        {job.description ? (
                          <div className="text-xs text-muted-foreground">{job.description}</div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => dismissJob(job.id)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Dismiss
                      </button>
                    </div>
                    <div className={`mt-1 text-xs font-semibold ${statusTone(job.status)}`}>
                      {job.status}
                    </div>
                    {job.message ? (
                      <div className="mt-1 text-xs text-red-700">{job.message}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
