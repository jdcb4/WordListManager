# UI Modernization Plan (No Implementation in This Step)

## Goals

- Make the app feel modern, fast, and mobile-friendly.
- Keep admin workflows efficient (publish, validation actions, staging review).
- Avoid breaking the current Django backend and APIs.

## Option A: Keep Django Templates + Progressive Enhancement

### Approach

- Continue server-rendered pages for routing/auth.
- Add modern CSS system and lightweight JS components.
- Improve visual hierarchy, spacing, typography, and interaction feedback.

### Pros

- Lowest migration risk.
- Fastest to ship improvements.
- Reuses existing templates and auth/session setup.

### Cons

- Long-term UI state complexity can get harder to manage.
- Less flexible than SPA for advanced interactions.

### Recommended stack for this option

- Keep Django templates.
- Add `htmx` for dynamic sections (tables/forms/messages).
- Add a utility CSS framework (`Tailwind`) or scoped CSS tokens/components.

## Option B: Hybrid React (Recommended Mid-Term)

### Approach

- Keep Django for auth, APIs, and management permissions.
- Build selected pages as React apps:
  - Swipe feedback UI
  - Validation issue action center
  - Staging review queue
- Serve React bundles from Django static files.

### Pros

- Best balance of modern UX and migration safety.
- Incremental rollout page-by-page.
- Keeps current backend and deployment simple.

### Cons

- Two frontend paradigms during transition.
- Requires build pipeline for frontend assets.

## Option C: Full React Frontend + Django API Backend

### Approach

- Build full SPA in React (or Next.js).
- Django becomes API-only backend.

### Pros

- Maximum UI flexibility and consistency.
- Strong long-term frontend architecture.

### Cons

- Highest migration effort and risk.
- Requires frontend auth integration changes and more deployment complexity.

## Recommended Sequence

1. Design system baseline
2. Improve current templates quickly (colors, spacing, card/table style, form controls, responsive layout)
3. Convert swipe feedback page to React first (best ROI)
4. Convert validation and staging management pages to React
5. Reassess full migration only after these wins

## Near-Term UX Improvements (Template-Compatible)

1. Add a consistent design token layer (`--spacing`, `--radius`, `--shadow`, semantic colors).
2. Replace basic tables with sticky headers, row hover states, and compact action toolbars.
3. Add async action feedback (loading states, success/error toasts, inline errors).
4. Add saved filters and bulk action counters.
5. Improve mobile behavior for management tables (stacked cards on narrow screens).

## React Migration Readiness Checklist

1. Confirm API coverage for all management actions.
2. Add API endpoints for validation issue actions (if needed).
3. Add CSRF/session strategy docs for React requests.
4. Add frontend build step in CI and deployment.
5. Track rollout with feature flags per page.
