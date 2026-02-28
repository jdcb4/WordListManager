# Word List Manager

Word List Manager is a Django + DRF app for managing a canonical word bank used by game projects (Pictionary, Charades, Celebrity, etc.).

## Implemented in this starter

- Core word management models:
  - `WordEntry` (guessing/describing words)
  - `Category` (configurable admin categories)
  - `DatasetVersion` (version/checksum for sync checks)
  - `ExportArtifact` (CSV/JSON export metadata)
- Text sanitization and dedupe key generation.
- Default categories are seeded as `Who`, `What`, `Where`.
- Guessing words require a category (enforced at DB level).
- Import from `source_data/words.csv` and `source_data/wordBank.json`.
- Publish command that generates versioned CSV/JSON exports and checksum.
- API:
  - `GET /api/v1/words/`
  - `GET /api/v1/words/random?count=...`
  - `GET /api/v1/stats`
  - `GET /api/v1/manifest`
  - `GET /api/v1/exports/latest.csv`
  - `GET /api/v1/exports/latest.json`
- Web UI:
  - `GET /` browse/filter words + download links
  - `GET /manage/` authenticated management dashboard
  - Staff-only publish action from dashboard
- Rate limiting configured in DRF (`anon`, `user`, `exports` scopes).

## Local setup

```bash
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py import_source_data
python manage.py publish_wordlist
python manage.py createsuperuser
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
4. (Optional) run dedupe maintenance:
```bash
python manage.py dedupe_words --dry-run
python manage.py dedupe_words
```
5. Clients check `/api/v1/manifest` weekly and compare `version_number` or `checksum_sha256`.

## Deployment (Railway)

1. Push this repo to GitHub.
2. Create a Railway project from the repo.
3. Add a PostgreSQL service.
4. Set app environment variables:
   - `SECRET_KEY`
   - `DEBUG=false`
   - `DATABASE_URL` (usually injected automatically from Railway Postgres)
   - `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` for your Railway domain
5. Railway starts with:
   - `python manage.py migrate && gunicorn wordlist_manager.wsgi --bind 0.0.0.0:$PORT`

## Notes

- Local default DB is SQLite.
- Railway DB should be PostgreSQL via `DATABASE_URL`.
- Phase 2 features (feedback, upload staging/review) are not yet implemented in this starter.
