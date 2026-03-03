import { Button } from "../ui/button";
import { StatusChip } from "../ui/status-chip";
import { useJobTracker } from "../../lib/job-tracker";

function statusTone(status) {
  if (status === "running") return "info";
  if (status === "success") return "success";
  if (status === "cancelled") return "warning";
  if (status === "error") return "danger";
  return "neutral";
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
                <StatusChip tone={statusTone(job.status)} className="mt-1 text-[11px] uppercase">
                  {job.status}
                </StatusChip>
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
