import { X } from "lucide-react";

export function FilterChip({ label, onClear }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2 py-1 text-xs hover:bg-muted"
    >
      <span>{label}</span>
      <X size={12} />
    </button>
  );
}
