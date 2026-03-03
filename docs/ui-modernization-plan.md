# UI Modernization Plan (Sidebar-First, Desktop-Primary, Responsive)

## Objective

- Make UX consistent across all React pages, especially control placement and table behavior.
- Use the sidebar as the single primary navigation pattern.
- Reduce page clutter by splitting overloaded pages into focused task pages.
- Keep desktop workflow speed as priority while maintaining solid mobile usability.

## Product Constraints

- Backend/API behavior stays unchanged unless a new endpoint is explicitly needed.
- Existing routes should keep working via redirects where paths change.
- Desktop is the primary use case, but all pages must remain responsive.

## UX Principles

- One primary navigation system: sidebar.
- One primary action zone: top-right page header.
- One filtering pattern: toolbar filters above table.
- One table pattern: consistent density, row actions, selection, and empty/loading states.
- One visual language: shared tokens and status semantics across pages.

## Information Architecture (Target)

### Sidebar is primary navigation

- Keep left sidebar as global primary nav on desktop.
- Keep mobile drawer version of same sidebar for smaller viewports.
- Remove `ManageTabs` from page bodies after migration.

### Proposed navigation groups

- Library
  - Word Library (`/`)
- Ingestion
  - Upload Files (`/manage/ingestion/upload`)
  - AI Generate (`/manage/ingestion/generate`)
  - Batch Monitor (`/manage/ingestion/batches`)
  - Staging Review (`/manage/staging`)
- Quality
  - Validation Queue (`/manage/validation`)
  - QA Completion (`/manage/qa`)
  - Feedback Moderation (`/manage/feedback`)
- Operations
  - Overview (`/manage`)
  - Jobs (`/manage/jobs`)
  - Settings (`/manage/settings`)
- Playtest
  - Swipe Feedback (`/feedback`)

## Page Decomposition Plan

### Ingestion split (high priority)

Current `ManageIngestionPage` combines three distinct workflows. Split into:

1. Upload Files page
- Purpose: upload CSV/JSON and annotate batch note.
- Controls: file input, note input, single submit action.
- Secondary section: latest uploaded batches summary.

2. AI Generate page
- Purpose: generate staged words with model/config controls.
- Controls: model, type, count, category/subcategory, difficulty, collection.
- Primary action: run generation job.

3. Batch Monitor page
- Purpose: view ingestion batches and statuses.
- Controls: status/source/date filters and search.
- Table: batch list with drill-down actions.

4. Staging Review remains dedicated
- Keep queue review, keyboard shortcuts, and side drawer.
- Remove ingestion-related explanatory clutter from this page.

### Other decluttering opportunities

- Keep `ManagePage` as overview/status only, no dense workflow controls.
- Keep `ManageJobsPage` as the single full jobs management screen.
- Keep `PageJobsPanel` minimal and contextual, not a second primary control surface.

## Control Placement Standards

### Global page skeleton

1. Header row
- Left: title + concise page description.
- Right: one primary button, up to two secondary actions.

2. Utility row (optional)
- Stats chips, model indicator, or workflow context.

3. Filter toolbar
- Search first.
- Structured filters next (status/type/category/date).
- View controls last (density, columns, saved view).

4. Data region
- Table or board with consistent container and spacing.

5. Selection actions
- Sticky bottom bulk action bar only when rows are selected.
- Do not duplicate identical destructive/primary actions in both header and bulk bar.

## Table Design Standards

- Default to compact density for operational management tables.
- Keep sticky header for desktop tables.
- Use the same column header style and sortable indicators everywhere.
- Place filters in a consistent toolbar; avoid mixing header multi-selects on one page and separate chips on another unless justified.
- Keep row click behavior consistent:
  - row opens side drawer details, or
  - row selection only (no mixed behavior without clear affordance).
- Standardize status rendering:
  - success/approved/keep -> success token
  - warning/pending -> warning token
  - error/rejected/deactivate -> danger token

## Visual Language Consistency

- Centralize semantic color tokens: `success`, `warning`, `danger`, `info`.
- Remove ad-hoc color classes from individual pages where possible.
- Standardize card radii, border opacity, shadow strength, and spacing scale.
- Keep typography scale consistent:
  - page title
  - section title
  - table text
  - helper/meta text
- Ensure badges, buttons, and dialog styles are token-driven, not page-specific.

## Responsive Strategy (Desktop-Primary)

### Desktop (primary)

- Sidebar pinned and always visible.
- Wide tables with horizontal scan priority.
- Filter controls in one row where possible.

### Tablet

- Sidebar can collapse to drawer.
- Filters wrap into two rows.
- Keep tables with horizontal scroll before switching representation.

### Mobile

- Sidebar via drawer only.
- Header actions stack cleanly.
- Preserve table usability with horizontal scroll and sticky first columns where needed.
- Convert only highly dense operational tables to card lists if readability drops materially.

## Implementation Phases

### Phase 1: Navigation and shell alignment

- Promote sidebar as sole primary nav.
- Remove `ManageTabs` from pages.
- Add redirects from old to new ingestion split routes.

### Phase 2: Shared layout and control conventions

- Introduce a shared `ManagementPageLayout` and `TableToolbar` pattern.
- Normalize header action ordering and max action count.
- Reduce sticky element conflicts (top and bottom stickies only).

### Phase 3: Ingestion page split

- Build `Upload`, `Generate`, and `Batch Monitor` pages.
- Move existing controls out of monolithic ingestion screen.
- Keep staging review focused on approve/reject workflow.

### Phase 4: Table standardization

- Align filtering strategy across library and manage pages.
- Standardize selection, bulk actions, and row detail behavior.
- Add accessibility labels to checkboxes/filter controls.

### Phase 5: Visual system hardening

- Replace page-specific color classes with semantic tokens.
- Audit spacing, typography, and status visuals across all pages.
- Validate desktop and mobile behavior against acceptance criteria.

## Acceptance Criteria

- Sidebar is the only primary navigation mechanism across management pages.
- No management page contains an additional top tab-strip nav.
- Ingestion workflows are split into focused pages with clear page-level purpose.
- Table controls follow a consistent placement pattern across pages.
- Visual style (color semantics, spacing, typography, card/table chrome) is consistent across all React pages.
- Desktop experience is optimized for fast scanning and bulk actions.
- Mobile remains usable without losing core workflow capabilities.

## Risks and Mitigation

- Risk: route churn confuses users.
- Mitigation: maintain redirects and consistent naming in sidebar.

- Risk: removing duplicated actions may slow some workflows.
- Mitigation: keep bulk actions for selected rows, keep page primary actions for page-level tasks.

- Risk: responsive regressions during layout unification.
- Mitigation: test each phase at desktop, tablet, and mobile breakpoints before rollout.

## Deliverables for This Planning Phase

- This modernization plan.
- Route map for new ingestion subpages.
- UI standards for navigation, controls, tables, and responsive behavior.
- Ordered implementation phases and acceptance criteria.

## Implementation Progress (March 3, 2026)

- Completed: Phase 1 (sidebar-first navigation + removal of in-page manage tabs).
- Completed: Phase 2 (shared `ManagementPageLayout` + `TableToolbar` across management pages).
- Completed: Phase 3 (split ingestion into Upload / AI Generate / Batch Monitor pages).
- In progress: Phase 4 (table standardization and accessibility labels):
  - Shared status rendering via `StatusChip` across jobs, staging/validation/feedback, and batch tables.
  - Added explicit `aria-label` attributes for management checkboxes and select controls.
  - Unified table row striping and filter control accessibility labels in `DataTable`.
- Next: Phase 5 (visual token hardening and spacing/typography audit on remaining non-management pages).
