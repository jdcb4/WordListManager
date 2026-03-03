import { cn } from "../../lib/utils";

export function TableToolbar({ left, right, className }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-muted/60 p-2 lg:flex-row lg:items-center lg:justify-between",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">{left}</div>
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">{right}</div>
    </div>
  );
}
