import { useState } from "react";
import { Menu, X } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import { cn } from "../../lib/utils";

const navGroups = [
  {
    label: "Library",
    items: [{ label: "Word Library", to: "/" }],
  },
  {
    label: "Ingestion",
    items: [
      { label: "Upload Files", to: "/manage/ingestion/upload" },
      { label: "AI Generate", to: "/manage/ingestion/generate" },
      { label: "Batch Monitor", to: "/manage/ingestion/batches" },
      { label: "Staging Review", to: "/manage/staging" },
    ],
  },
  {
    label: "Quality",
    items: [
      { label: "QA Tools", to: "/manage/qa" },
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
    items: [
      { label: "Overview", to: "/manage" },
      { label: "Jobs", to: "/manage/jobs" },
      { label: "Settings", to: "/manage/settings" },
    ],
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

function AppNavContents({ onNavigate }) {
  return (
    <>
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
                <div key={item.to} onClick={onNavigate ? () => onNavigate() : undefined}>
                  <AppNavItem item={item} />
                </div>
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
    </>
  );
}

export function AppShell({ children }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const isImmersiveRoute =
    location.pathname.startsWith("/feedback/app") ||
    location.pathname.startsWith("/feedback/swipe/app");

  if (isImmersiveRoute) {
    return (
      <div className="min-h-screen bg-app">
        <main className="mx-auto max-w-[720px] p-3 sm:p-4">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app">
      <div className="mx-auto grid max-w-[1440px] gap-4 px-4 py-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden rounded-2xl border border-border bg-card p-4 shadow-sm lg:sticky lg:top-4 lg:block lg:h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <AppNavContents />
        </aside>
        <main className="space-y-4">
          <div className="sticky top-2 z-30 lg:hidden">
            <div className="flex items-center justify-between rounded-xl border border-border bg-card/95 px-3 py-2 shadow-sm backdrop-blur">
              <p className="text-sm font-semibold">WordListManager</p>
              <button
                type="button"
                onClick={() => setMobileNavOpen((value) => !value)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
              >
                {mobileNavOpen ? <X size={14} /> : <Menu size={14} />}
                Menu
              </button>
            </div>
          </div>
          {children}
        </main>
      </div>
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            className="h-full flex-1 bg-black/35"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="h-full w-[300px] max-w-[85vw] overflow-y-auto border-l border-border bg-card p-4 shadow-xl">
            <AppNavContents onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
