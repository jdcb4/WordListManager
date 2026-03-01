# React Frontend Transition

This folder is the start of the React migration using Tailwind and shadcn-style UI components.

Implemented pages:

1. Landing page (`/landing`)
2. Feedback interface (`/feedback`)
3. Management interface (`/manage`)

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
