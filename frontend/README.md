# React Frontend Transition

This folder is the start of the React migration using Tailwind and shadcn-style UI components.

Implemented pages:

1. Landing page (`/landing`)
2. Feedback interface (`/feedback`)
3. Management overview (`/manage`)
4. Management staging (`/manage/staging`)
5. Management validation (`/manage/validation`)
6. Management feedback moderation (`/manage/feedback`)
   - Staging includes upload/review with field-by-field change previews

## Single-host deployment

Recommended production setup is to serve React from the same Django host:

1. Docker builds `frontend/dist`.
2. Django serves management routes with a React shell.
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
