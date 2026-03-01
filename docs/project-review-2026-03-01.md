# Project Review Report (March 1, 2026)

## Executive Summary

The project has moved from a Django-template-first app to a React-first UX with Django/DRF as the backend, while keeping Django Admin intact. Core domain capabilities (word lifecycle, staging, validation, AI-assisted enrichment/generation, publish/versioning, CSV/JSON exports) are in place and coherent.

The largest remaining gaps are around operational hardening (upload controls, abuse resistance on staff actions, auditability), and continued UI consolidation to reduce duplicated logic between legacy template flows and React APIs.

## What Is Working Well

1. Clear domain model with dedicated entities for `WordEntry`, `Collection`, staging, feedback, and dataset versioning.
2. Deterministic publishing pipeline with validation + export artifact tracking.
3. AI features integrated through staging (safer than direct production mutation).
4. React migration strategy uses backend feature flags and allows gradual rollout.
5. Good baseline test coverage across words, web UI, and API layers.

## Engineering & Best Practice Findings

### High Priority

1. Dual UI stacks still active:
   - Legacy Django template actions remain present alongside React API paths.
   - Recommendation: continue deprecating template-only workflows behind one compatibility toggle and remove dead paths after cutover.

2. Reusable front-end state/action patterns:
   - Repeated fetch/action/message patterns across management pages.
   - Recommendation: centralize with shared hooks (`useManageAction`, `useLoadResource`) and toast-based status handling.

### Medium Priority

1. API contract consistency:
   - Some endpoints return terse payloads, others nested report objects.
   - Recommendation: standardize shape with `{status, message, data}` and typed error payloads.

2. Validation issue ergonomics:
   - `word` metadata is now included, but could include a direct edit/review link or batch action hints.

3. Testing depth:
   - Add E2E tests for critical flows (upload -> stage review -> publish, validation actioning, AI generate -> stage).

### Low Priority

1. Introduce lint/format CI gates for frontend and Python static checks (`ruff`, `mypy` optional).
2. Add API schema docs (OpenAPI) for downstream client integration.

## Security Review Findings

### High Priority

1. Staging upload guardrails:
   - File type and size constraints should be explicit.
   - Recommendation: enforce max upload size and allowlist extensions/content-types server-side.

2. Staff action throttling / abuse safeguards:
   - Management endpoints are staff-protected but not explicitly scoped/throttled.
   - Recommendation: add scoped throttles/logging for destructive endpoints (bulk deactivate/reject/publish).

### Medium Priority

1. Audit trail:
   - Many operations update status but structured audit events are limited.
   - Recommendation: add model-backed audit entries for staging approvals, validation actions, feedback resolutions, and publish runs.

2. Secrets and environment validation:
   - Startup should validate required production env vars and fail fast if missing.

### Low Priority

1. Add basic security headers review (CSP plan, Referrer-Policy, HSTS in production).
2. Consider optional 2FA policy for admin/staff accounts.

## UX/UI Review Findings

### Strengths

1. Unified React navigation across major workflows.
2. Staging diff previews improve decision quality.
3. React-first non-admin experience reduces context switching.

### Improvements Implemented In This Iteration

1. Landing moved to table-based interaction with multi-select filters and infinite scroll.
2. Sorting/filtering controls integrated into table headers.
3. Management workflows separated into dedicated tabs/pages (Overview, Staging, AI, Validation, Feedback).
4. Validation now surfaces the related word details directly.
5. Shared table component adopted across landing + management tables.
6. Mobile swipe reliability improvements for feedback interactions.

### Next UX Iteration Suggestions

1. Replace inline JSON status messages with non-blocking toast notifications and action summaries.
2. Add saved filter presets for staging/validation.
3. Introduce sticky action bars for bulk actions with selected-row count.
4. Add optimistic UI for moderation actions and staged row updates.

## Feature Recommendations

1. Role segmentation:
   - Distinguish reviewer vs publisher permissions.
2. Validation workflow enhancements:
   - Bulk “fix suggestion” queues and reason codes on deactivation.
3. Dataset release controls:
   - Scheduled publish, release notes, rollback to prior version.
4. Data quality intelligence:
   - Similarity checks for near-duplicate words/hints (fuzzy matching).

## Recommended 30-Day Roadmap

1. Security hardening sprint:
   - Upload limits, management throttle scopes, audit log model, startup env validation.
2. UX stabilization sprint:
   - Toast system, saved filters, sticky bulk action bars, E2E smoke tests.
3. Legacy cleanup sprint:
   - Remove duplicate template-only flows after user acceptance on React paths.
