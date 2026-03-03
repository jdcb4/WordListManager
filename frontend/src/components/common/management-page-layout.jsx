import { PageHeader } from "./page-header";
import { PageJobsPanel } from "./page-jobs-panel";

export function ManagementPageLayout({
  title,
  description,
  primaryAction,
  secondaryActions,
  jobsSource,
  children,
}) {
  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        description={description}
        primaryAction={primaryAction}
        secondaryActions={secondaryActions}
      />
      {jobsSource ? <PageJobsPanel source={jobsSource} /> : null}
      {children}
    </div>
  );
}
