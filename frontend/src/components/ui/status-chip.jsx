import { Badge } from "./badge";
import { cn } from "../../lib/utils";

const STATUS_STYLES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  neutral: "border-border bg-muted text-foreground",
};

export function StatusChip({ tone = "neutral", className, children, ...props }) {
  return (
    <Badge className={cn(STATUS_STYLES[tone] || STATUS_STYLES.neutral, className)} {...props}>
      {children}
    </Badge>
  );
}

export function statusToneClass(tone = "neutral") {
  return STATUS_STYLES[tone] || STATUS_STYLES.neutral;
}
