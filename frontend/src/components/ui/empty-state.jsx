export function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center shadow-sm">
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
