import { NavLink } from "react-router-dom";

import { cn } from "../../lib/utils";

const tabs = [
  { label: "Overview", href: "/manage", key: "overview" },
  { label: "Ingestion", href: "/manage/ingestion", key: "ingestion" },
  { label: "Staging", href: "/manage/staging", key: "staging" },
  { label: "QA", href: "/manage/qa", key: "qa" },
  { label: "Validation", href: "/manage/validation", key: "validation" },
  { label: "Feedback", href: "/manage/feedback", key: "feedback" },
  { label: "Jobs", href: "/manage/jobs", key: "jobs" },
  { label: "Settings", href: "/manage/settings", key: "settings" },
];

export function ManageTabs({ active }) {
  return (
    <div className="rounded-xl border border-border bg-card p-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.href}
            to={tab.href}
            end={tab.href === "/manage"}
            className={({ isActive }) =>
              cn(
                "rounded-lg px-3 py-1.5 text-sm transition",
                isActive || active === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-white text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
