# Get Words API

This guide covers the public read-only endpoints for fetching words and dataset metadata.

## Base URL

- Local: `http://localhost:8000`
- API prefix: `/api/v1`

## 1) List Words

`GET /api/v1/words/`

Returns active words with pagination.

### Query Parameters

- `q`: text search across word, hint, and subcategory
- `word_type`: `guessing`, `describing`, or CSV values (`guessing,describing`)
- `category`: category name (supports CSV values)
- `collection`: collection name (supports CSV values)
- `difficulty`: `easy`, `medium`, `hard` (supports CSV values)
- `ordering`: one of `sanitized_text`, `word_type`, `difficulty`, `category__name`, `collection__name`, `updated_at`, `id` (prefix with `-` for descending)
- `limit`: page size (default 100)
- `offset`: pagination offset

### Example

```bash
curl "http://localhost:8000/api/v1/words/?q=harbour&word_type=guessing,describing&difficulty=easy,medium&ordering=sanitized_text&limit=50&offset=0"
```

## 2) Random Words

`GET /api/v1/words/random?count=10`

Returns a random set of active words.

### Query Parameters

- `count`: number of words (min 1, max 100)

### Example

```bash
curl "http://localhost:8000/api/v1/words/random?count=5"
```

## 3) Word Stats

`GET /api/v1/stats`

Returns totals, type distribution, difficulty breakdown, category/collection counts, and current dataset version.

### Example

```bash
curl "http://localhost:8000/api/v1/stats"
```

## 4) Dataset Manifest

`GET /api/v1/manifest`

Returns current dataset version/checksum and export metadata so clients can detect updates.

### Example

```bash
curl "http://localhost:8000/api/v1/manifest"
```

## 5) Download Latest Full Export

For direct browser/user downloads (CSV/JSON files):

- `GET /exports/latest.csv`
- `GET /exports/latest.json`

Machine/API download endpoints are also available:

- `GET /api/v1/exports/latest.csv`
- `GET /api/v1/exports/latest.json`

Both download file names include the published version, e.g. `wordlist_v12.csv`.

## Response Field Notes

Word rows include:

- `word`: cleaned display text
- `word_type`: canonical type
- `word_types`: supported types for that word
- `versionNumber`: dataset version included in export CSV/JSON files
