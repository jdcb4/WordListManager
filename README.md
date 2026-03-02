# Word List Manager

Word List Manager is a Django + DRF app for managing a canonical word bank used by game projects (Pictionary, Charades, Celebrity, etc.).

## Implemented in this starter

- Core word management models:
  - `WordEntry` (single canonical word row, can support guessing and/or describing)
  - `Category` (configurable admin categories)
  - `Collection` (e.g. Base, Christmas, Kids)
  - `DatasetVersion` (version/checksum for sync checks)
  - `ExportArtifact` (CSV/JSON export metadata)
- Text sanitization and dedupe key generation.
- Canonical word consolidation: one definitive row per normalized word.
- Default categories are seeded as `Who`, `What`, `Where`.
- Existing words are assigned to `Base` collection.
- Guessing words require a category (enforced at DB level).
- Import from `source_data/words.csv` and `source_data/wordBank.json`.
- Publish pipeline command (dedupe + validation + versioned CSV/JSON exports + report).
- API:
  - `GET /api/v1/words/`
  - `GET /api/v1/words/random?count=...`
  - `GET /api/v1/stats`
  - `GET /api/v1/manifest`
  - `GET /api/v1/exports/latest.csv`
  - `GET /api/v1/exports/latest.json`
  - `POST /api/v1/feedback`
  - Staff management APIs for React transition:
    - `GET /api/v1/manage/dashboard`
    - `POST /api/v1/manage/publish`
    - `POST /api/v1/manage/dedupe`
    - `POST /api/v1/manage/consolidate`
    - `GET /api/v1/manage/feedback/pending`
    - `POST /api/v1/manage/feedback/resolve`
    - `GET /api/v1/manage/staging`
    - `POST /api/v1/manage/staging/upload`
    - `POST /api/v1/manage/staging/review`
    - `GET /api/v1/manage/validate`
    - `GET /api/v1/manage/qa/candidates`
    - `POST /api/v1/manage/validation/action`
    - `POST /api/v1/manage/ai/complete`
    - `POST /api/v1/manage/ai/generate`
- Web UI:
  - `GET /` React landing page (word browse/filter/download)
  - `GET /feedback/` React feedback swipe UI
  - `GET /feedback/app/` immersive mobile-focused swipe UI
  - `GET /manage/` React management overview (authenticated staff)
  - `GET /manage/ingestion/` React ingestion workflow (upload + AI generation)
  - `GET /manage/qa/` React QA workflow (complete missing fields)
  - `GET /manage/ai/` legacy alias to QA workflow
  - `GET /manage/staging/` React staging workflow
  - `GET /manage/validation/` React validation workflow
  - `GET /manage/feedback/` React moderation workflow
  - Django Admin remains at `GET /admin/`
  - Staff one-click publish action from dashboard
  - Dashboard actions for import, dedupe, validate, deploy config check
  - Dashboard AI actions:
    - Complete missing hint/difficulty fields
    - Generate words into staging
  - Bulk moderation actions for feedback and staging queues
  - Legacy Django templates remain as fallback only if React UI is disabled or bundle assets are missing
- Rate limiting configured in DRF (`anon`, `user`, `exports` scopes).

## Local setup

```bash
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py import_source_data
python manage.py publish_wordlist
python manage.py createsuperuser
python manage.py check_deploy_config
python manage.py validate_wordlist
python manage.py runserver
```

## Data workflow

1. Update source files in `source_data/`.
2. Import into database:
```bash
python manage.py import_source_data
```
3. Publish new dataset version + exports:
```bash
python manage.py publish_wordlist
```
3.1 Publish options:
```bash
python manage.py publish_wordlist --skip-dedupe
python manage.py publish_wordlist --skip-validation
python manage.py publish_wordlist --allow-validation-errors
python manage.py publish_wordlist --report-path ./exports/publish_report.json
```
4. (Optional) run dedupe maintenance:
```bash
python manage.py dedupe_words --dry-run
python manage.py dedupe_words
python manage.py consolidate_words --dry-run
python manage.py consolidate_words
```
5. Run validation explicitly:
```bash
python manage.py validate_wordlist
python manage.py validate_wordlist --fail-on-warnings
```
6. Clients check `/api/v1/manifest` weekly and compare `version_number` or `checksum_sha256`.

## Canonical word migration strategy

- Deploy-time: `python manage.py migrate` applies data migrations automatically (including canonical word consolidation).
- On-demand: staff can trigger consolidation from **Management -> Settings -> Run Consolidation** or via command:
```bash
python manage.py consolidate_words
```
- Rule used for legacy duplicates: when both guessing/describing rows exist for the same normalized word, describing row data is retained and type suitability is merged.

## Staging upload format

CSV and JSON uploads are supported in `/manage/staging/`.

- CSV fields:
  - `word`, `word_type`, `category`, `collection`, `subcategory`, `hint`, `difficulty`
- JSON shape:
  - List of objects or `{"words":[...]}`
  - Same fields as CSV keys

Sample upload fixtures are in `sample_uploads/`:

- `sample_correct_words.csv`
- `sample_duplicate_words.csv`
- `sample_incomplete_words.csv`
- `sample_correct_words.json`
- `sample_duplicate_words.json`
- `sample_incomplete_words.json`

## Client sync example

Use [client_sync.py](examples/client_sync.py) as a weekly sync task in downstream apps:

```bash
python examples/client_sync.py --manifest-url https://wordlistmanager-production.up.railway.app/api/v1/manifest --format json
```

If checksum is unchanged, it exits without downloading. If changed, it downloads the latest export and updates local state.

## AI features

Management interface AI actions use OpenRouter with:

- API key env var: `OPEN_ROUTER_API_KEY`
- Default model: `google/gemini-2.5-flash-lite` (override with `OPENROUTER_MODEL`)

Functions:

1. Complete missing word template fields (`hint` / `difficulty`) in batches of up to 50.
2. Generate new words from prompt inputs (type/category/subcategory/difficulty/collection), sent to staging for normal review flow.
   - Generation is constrained to active schema categories for guessing words.
   - Invalid AI categories are skipped before staging.

3. Complete Missing now stages AI suggestions first (does not directly update production words).
   - Review and approve in staging like other uploads.
   - You can run it globally, from a selectable QA table, or on selected words in validation UI.

## UI modernization plan

See [ui-modernization-plan.md](docs/ui-modernization-plan.md) for a non-implementation plan covering:

- Django template modernization path
- Hybrid React migration path
- Full React SPA path

Latest implementation and architecture review:

- [project-review-2026-03-01.md](docs/project-review-2026-03-01.md)

## React transition

Initial React + Tailwind + shadcn-style frontend scaffold lives in [frontend/README.md](frontend/README.md).

Implemented React pages:

1. Landing page (`/`, `/landing`)
2. Feedback page (`/feedback`, `/feedback/swipe`, `/feedback/app`)
3. Management page (`/manage`)
   - Includes React staging review with bulk approve/reject and per-field update preview (current vs staged values)
4. Dedicated management routes:
   - `/manage/ingestion`
   - `/manage/qa` (legacy alias `/manage/ai`)
   - `/manage/staging`
   - `/manage/validation`
   - `/manage/feedback`

React handoff configuration:

- `REACT_UI_ENABLED=true` (default)
- `REACT_UI_BASE_URL=` for single-host mode (recommended)
- `REACT_UI_BASE_URL=https://<frontend-host>` for separate-host mode (optional)
- `REACT_MANAGE_UI_ENABLED` remains as legacy compatibility flag

Single-host mode (recommended):

- Set `REACT_UI_ENABLED=true`
- Leave `REACT_UI_BASE_URL` blank
- Django serves React shell directly on non-admin routes.

Separate-host mode:

- Set `REACT_UI_ENABLED=true` and `REACT_UI_BASE_URL=<frontend host>`
- Django non-admin routes redirect to external React host.

Separate-host route mapping:

- `/` -> `${REACT_UI_BASE_URL}/`
- `/feedback/` -> `${REACT_UI_BASE_URL}/feedback`
- `/feedback/app/` -> `${REACT_UI_BASE_URL}/feedback/app`
- `/manage/` -> `${REACT_UI_BASE_URL}/manage`
- `/manage/ingestion/` -> `${REACT_UI_BASE_URL}/manage/ingestion`
- `/manage/qa/` -> `${REACT_UI_BASE_URL}/manage/qa`
- `/manage/ai/` -> `${REACT_UI_BASE_URL}/manage/ai`
- `/manage/staging/` -> `${REACT_UI_BASE_URL}/manage/staging`
- `/manage/validation/` -> `${REACT_UI_BASE_URL}/manage/validation`
- `/manage/feedback/` -> `${REACT_UI_BASE_URL}/manage/feedback`

## Deployment (Railway)

1. Push this repo to GitHub.
2. Create a Railway project from the repo.
3. Add a PostgreSQL service.
4. Set app environment variables:
   - `SECRET_KEY`
   - `DEBUG=false`
   - `DATABASE_URL` (usually injected automatically from Railway Postgres)
   - `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` for your Railway domain
   - `WEB_CONCURRENCY=2`
   - `GUNICORN_TIMEOUT=300` (recommended for long AI QA runs)
5. Railway starts with:
   - `./start.sh`
6. Create a Django admin user from Railway shell:
   - `python manage.py createsuperuser`
7. Import and publish initial dataset:
   - `python manage.py import_source_data`
   - `python manage.py publish_wordlist`

## Railway checklist

1. Set environment variables:
   - `DEBUG=false`
   - `SECRET_KEY=<strong random value>`
   - `ALLOWED_HOSTS=<your Railway app domain>`
   - `CSRF_TRUSTED_ORIGINS=https://<your Railway app domain>`
   - `WEB_CONCURRENCY=2`
   - `GUNICORN_TIMEOUT=300`
   - `GUNICORN_GRACEFUL_TIMEOUT=30`
2. Validate health endpoint:
   - `/healthz` returns HTTP 200.
3. Validate admin access:
   - `/admin/` login works.
4. Validate exports:
   - `/api/v1/exports/latest.csv` and `/api/v1/exports/latest.json` return files.
5. Keep host checks explicit:
   - Set `ALLOWED_HOSTS=<domain1,domain2>`
   - Keep explicit `CSRF_TRUSTED_ORIGINS=https://<domain1>,https://<domain2>`

## Notes

- Local default DB is SQLite.
- Railway DB should be PostgreSQL via `DATABASE_URL`.
- Phase 2 foundation is implemented (feedback and staging workflows) and can be extended with batch tools and moderation rules.
