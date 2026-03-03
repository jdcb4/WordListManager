import { Badge } from "./badge";
import { cn } from "../../lib/utils";

const STATUS_STYLES = {
  success: "border-success-border bg-success-soft text-success-foreground",
  warning: "border-warning-border bg-warning-soft text-warning-foreground",
  danger: "border-danger-border bg-danger-soft text-danger-foreground",
  info: "border-info-border bg-info-soft text-info-foreground",
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
