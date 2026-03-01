import { cn } from "../../lib/utils";

export function SideDrawer({ open, title, subtitle, onClose, children, width = "max-w-xl" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 p-2 sm:p-4" onClick={onClose}>
      <aside
        className={cn(
          "h-full w-full overflow-y-auto rounded-2xl border border-border bg-card shadow-xl",
          width
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-border bg-card px-4 py-3">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-2 py-1 text-sm hover:bg-muted"
          >
            Close
          </button>
        </div>
        <div className="p-4">{children}</div>
      </aside>
    </div>
  );
}
