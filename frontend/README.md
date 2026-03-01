# React Frontend Transition

This folder is the start of the React migration using Tailwind and shadcn-style UI components.

Implemented pages:

1. Landing page (`/`, `/landing`)
2. Feedback interface (`/feedback`, `/feedback/swipe`)
3. Management overview (`/manage`)
4. Management ingestion (`/manage/ingestion`)
5. Management staging (`/manage/staging`)
6. Management QA tools (`/manage/qa`, legacy alias `/manage/ai`)
7. Management validation (`/manage/validation`)
8. Management feedback moderation (`/manage/feedback`)
   - Staging includes queue workflow, field-by-field change drawer, and shortcuts (`J/K`, `A`, `R`)

Shared UX primitives now used across pages:

- App shell with grouped sidebar navigation
- Consistent page headers with primary/secondary actions
- Reusable data table component (sorting, visibility, density)
- Empty states, bulk action bar, side drawer, confirm dialogs

## Single-host deployment

Recommended production setup is to serve React from the same Django host:

1. Docker builds `frontend/dist`.
2. Django serves non-admin routes with a React shell.
3. API calls stay relative (`/api/...`) and share session/CSRF cookies.

## Run locally

From `frontend/`:

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

The Vite dev server proxies API/auth requests to Django at `http://localhost:8000`.

## Notes

- Django Admin is intentionally not migrated.
- Management APIs for React are under `/api/v1/manage/*` and require staff login session.
