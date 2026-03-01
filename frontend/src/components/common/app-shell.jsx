import { NavLink } from "react-router-dom";

import { cn } from "../../lib/utils";
import { CurrentJobsPanel } from "./current-jobs-panel";

const navGroups = [
  {
    label: "Library",
    items: [{ label: "Word Library", to: "/" }],
  },
  {
    label: "Ingest",
    items: [
      { label: "Ingestion", to: "/manage/ingestion" },
      { label: "Staging", to: "/manage/staging" },
      { label: "QA Tools", to: "/manage/qa" },
    ],
  },
  {
    label: "Quality",
    items: [
      { label: "Validation", to: "/manage/validation" },
      { label: "Feedback Mod", to: "/manage/feedback" },
    ],
  },
  {
    label: "Playtest",
    items: [{ label: "Swipe Feedback", to: "/feedback" }],
  },
  {
    label: "Manage",
    items: [{ label: "Overview", to: "/manage" }],
  },
];

function AppNavItem({ item }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          "block rounded-lg px-3 py-2 text-sm transition",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )
      }
      end={item.to === "/"}
    >
      {item.label}
    </NavLink>
  );
}

export function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-app">
      <div className="mx-auto grid max-w-[1440px] gap-4 px-4 py-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <div className="mb-6 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">WordListManager</p>
            <p className="text-xl font-semibold tracking-tight">Operations Console</p>
          </div>
          <nav className="space-y-4">
            {navGroups.map((group) => (
              <section key={group.label} className="space-y-2">
                <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h2>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <AppNavItem key={item.to} item={item} />
                  ))}
                </div>
              </section>
            ))}
          </nav>
          <div className="mt-6 border-t border-border pt-4">
            <a
              href="/admin/"
              className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Django Admin
            </a>
          </div>
        </aside>
        <main className="space-y-4">
          {children}
          <CurrentJobsPanel />
        </main>
      </div>
    </div>
  );
}
