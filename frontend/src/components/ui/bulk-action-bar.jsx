import { cn } from "../../lib/utils";

export function BulkActionBar({ selectedCount, children, className }) {
  if (!selectedCount) return null;
  return (
    <div
      className={cn(
        "sticky bottom-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-md",
        className
      )}
    >
      <span className="mr-2 text-sm font-medium">{selectedCount} selected</span>
      {children}
    </div>
  );
}
