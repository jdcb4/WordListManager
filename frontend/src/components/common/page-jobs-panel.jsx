import { Button } from "../ui/button";
import { useJobTracker } from "../../lib/job-tracker";

function tone(status) {
  if (status === "running") return "text-sky-700";
  if (status === "success") return "text-emerald-700";
  if (status === "cancelled") return "text-amber-700";
  if (status === "error") return "text-red-700";
  return "text-muted-foreground";
}

export function PageJobsPanel({ source }) {
  const { jobs, cancelJob, dismissJob } = useJobTracker();
  const pageJobs = jobs.filter((job) => job.source === source).slice(0, 6);

  if (!pageJobs.length) return null;

  return (
    <div className="sticky top-2 z-20 rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Page Jobs</h3>
        <span className="text-xs text-muted-foreground">
          {pageJobs.filter((job) => job.status === "running").length} running / {pageJobs.length} tracked
        </span>
      </div>
      <div className="space-y-2">
        {pageJobs.map((job) => (
          <div key={job.id} className="rounded-lg border border-border bg-white px-3 py-2 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{job.title}</div>
                {job.description ? <div className="text-xs text-muted-foreground">{job.description}</div> : null}
                <div className={`text-xs font-semibold ${tone(job.status)}`}>{job.status}</div>
              </div>
              <div className="flex gap-1">
                {job.status === "running" ? (
                  <Button size="sm" variant="outline" onClick={() => cancelJob(job.id)}>
                    Cancel
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => dismissJob(job.id)}>
                    Dismiss
                  </Button>
                )}
              </div>
            </div>
            {job.message ? <div className="mt-1 text-xs text-muted-foreground">{job.message}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

