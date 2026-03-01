import { cn } from "../../lib/utils";

export function PageHeader({
  title,
  description,
  primaryAction,
  secondaryActions,
  className,
}) {
  return (
    <header className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {secondaryActions}
          {primaryAction}
        </div>
      </div>
    </header>
  );
}
