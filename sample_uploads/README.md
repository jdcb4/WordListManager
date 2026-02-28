# Sample Upload Files

Use these files with `/manage/staging/` to test upload and review flows.

- `sample_correct_words.csv` and `sample_correct_words.json`
  - Valid records for normal staging.
- `sample_duplicate_words.csv` and `sample_duplicate_words.json`
  - Intentional duplicates to test dedupe/review handling.
- `sample_incomplete_words.csv` and `sample_incomplete_words.json`
  - Missing fields (empty word, missing category for guessing) to test validation/review paths.

Supported fields:

- `word`
- `word_type` (`guessing` or `describing`)
- `category`
- `collection`
- `subcategory`
- `hint`
- `difficulty` (`easy`, `medium`, `hard`)
