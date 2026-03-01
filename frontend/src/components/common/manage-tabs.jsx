const tabs = [
  { label: "Overview", href: "/manage/" },
  { label: "Staging", href: "/manage/staging/" },
  { label: "AI", href: "/manage/ai/" },
  { label: "Validation", href: "/manage/validation/" },
  { label: "Feedback", href: "/manage/feedback/" },
];

export function ManageTabs({ active }) {
  return (
    <div className="rounded-xl border border-border bg-white p-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <a
            key={tab.href}
            href={tab.href}
            className={
              active === tab.label.toLowerCase()
                ? "rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground"
                : "rounded-full border border-border bg-white px-3 py-1 text-sm"
            }
          >
            {tab.label}
          </a>
        ))}
      </div>
    </div>
  );
}
