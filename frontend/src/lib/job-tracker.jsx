import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "wordlist_manager_jobs_v1";
const JobTrackerContext = createContext(null);

function createJobId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeLoadJobs() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

export function JobTrackerProvider({ children }) {
  const [jobs, setJobs] = useState(() => safeLoadJobs());

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.slice(0, 40)));
    } catch (_err) {
      // no-op
    }
  }, [jobs]);

  const startJob = useCallback(({ title, description = "", source = "app" }) => {
    const id = createJobId();
    const nowIso = new Date().toISOString();
    const nextJob = {
      id,
      title,
      description,
      source,
      status: "running",
      createdAt: nowIso,
      startedAt: nowIso,
      endedAt: null,
      message: "",
    };
    setJobs((prev) => [nextJob, ...prev].slice(0, 40));
    return id;
  }, []);

  const updateJob = useCallback((id, patch) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === id ? { ...job, ...patch } : job))
    );
  }, []);

  const finishJob = useCallback(
    (id, { status, message = "" }) => {
      updateJob(id, { status, message, endedAt: new Date().toISOString() });
    },
    [updateJob]
  );

  const dismissJob = useCallback((id) => {
    setJobs((prev) => prev.filter((job) => job.id !== id));
  }, []);

  const clearFinishedJobs = useCallback(() => {
    setJobs((prev) => prev.filter((job) => job.status === "running"));
  }, []);

  const runJob = useCallback(
    async ({ title, description = "", source = "app", task }) => {
      const jobId = startJob({ title, description, source });
      try {
        const result = await task();
        finishJob(jobId, { status: "success" });
        return result;
      } catch (err) {
        finishJob(jobId, { status: "error", message: String(err) });
        throw err;
      }
    },
    [finishJob, startJob]
  );

  const value = useMemo(
    () => ({
      jobs,
      runningCount: jobs.filter((job) => job.status === "running").length,
      startJob,
      updateJob,
      finishJob,
      dismissJob,
      clearFinishedJobs,
      runJob,
    }),
    [jobs, startJob, updateJob, finishJob, dismissJob, clearFinishedJobs, runJob]
  );

  return <JobTrackerContext.Provider value={value}>{children}</JobTrackerContext.Provider>;
}

export function useJobTracker() {
  const context = useContext(JobTrackerContext);
  if (!context) {
    throw new Error("useJobTracker must be used within JobTrackerProvider.");
  }
  return context;
}
