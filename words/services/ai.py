"""AI-assisted word tooling using OpenRouter."""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from itertools import islice
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.db.models import Q

from words.models import Category, Collection, Difficulty, WordEntry
from words.services.normalization import sanitize_text
from words.services.staging import create_batch_from_rows

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-2.5-flash-lite")
MAX_AI_BATCH = 50


class AIServiceError(RuntimeError):
    """Raised when the AI service call fails or returns invalid data."""


def _chunked(values: list, size: int):
    iterator = iter(values)
    while True:
        chunk = list(islice(iterator, size))
        if not chunk:
            return
        yield chunk


def _extract_json_text(text: str) -> str:
    direct = text.strip()
    if direct.startswith("{") or direct.startswith("["):
        return direct
    object_match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if object_match:
        return object_match.group(0)
    array_match = re.search(r"\[.*\]", text, flags=re.DOTALL)
    if array_match:
        return array_match.group(0)
    raise AIServiceError("Model response did not contain JSON.")


def _parse_message_content(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and "text" in item:
                parts.append(str(item["text"]))
        return "\n".join(parts)
    return str(content)


def _chat_json(*, system_prompt: str, user_prompt: str, model: str) -> dict:
    api_key = os.getenv("OPEN_ROUTER_API_KEY", "").strip()
    if not api_key:
        raise AIServiceError("OPEN_ROUTER_API_KEY is not configured.")

    payload = {
        "model": model or DEFAULT_MODEL,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    req = Request(
        OPENROUTER_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=90) as response:
            parsed = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise AIServiceError(f"OpenRouter HTTP error {exc.code}: {body}") from exc
    except URLError as exc:
        raise AIServiceError(f"OpenRouter network error: {exc}") from exc

    try:
        content = parsed["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise AIServiceError("OpenRouter response missing choices/message content.") from exc

    raw_text = _parse_message_content(content)
    json_text = _extract_json_text(raw_text)
    try:
        decoded = json.loads(json_text)
    except json.JSONDecodeError as exc:
        raise AIServiceError(f"Could not parse model JSON output: {exc}") from exc
    if not isinstance(decoded, dict):
        raise AIServiceError("Model output JSON must be an object.")
    return decoded


def _allowed_category_map() -> dict[str, str]:
    return {
        name.casefold(): name
        for name in Category.objects.filter(is_active=True).values_list("name", flat=True)
    }


def _allowed_collection_map() -> dict[str, str]:
    return {
        name.casefold(): name
        for name in Collection.objects.filter(is_active=True).values_list("name", flat=True)
    }


def complete_word_templates(
    *,
    word_ids: list[int] | None = None,
    model: str | None = None,
    limit: int | None = None,
    created_by=None,
) -> dict:
    queryset = WordEntry.objects.filter(is_active=True).select_related("category", "collection")
    if word_ids:
        queryset = queryset.filter(id__in=word_ids)
    filtered = queryset.filter(
        Q(hint="") | Q(hint__isnull=True) | Q(difficulty="") | Q(difficulty__isnull=True)
    ).order_by("id")
    if (not word_ids) and limit is not None and limit > 0:
        filtered = filtered[:limit]
    words = list(filtered)
    staged_rows = []
    suggested = 0
    processed = 0
    batches = 0

    system_prompt = (
        "You enrich game word templates. Return strict JSON only. "
        "Difficulty must be one of easy, medium, hard or empty string."
    )

    for chunk in _chunked(words, MAX_AI_BATCH):
        batches += 1
        request_items = [
            {
                "id": word.id,
                "word": word.sanitized_text,
                "word_type": word.word_type,
                "category": word.category.name if word.category else "",
                "collection": word.collection.name if word.collection else "Base",
                "subcategory": word.subcategory,
                "hint": word.hint,
                "difficulty": word.difficulty,
            }
            for word in chunk
        ]
        user_prompt = (
            "Fill missing hint/difficulty values where blank.\n"
            "Return JSON: {\"items\":[{\"id\":int,\"hint\":str,\"difficulty\":str}]}\n"
            f"Input items:\n{json.dumps(request_items, ensure_ascii=False)}"
        )
        response = _chat_json(system_prompt=system_prompt, user_prompt=user_prompt, model=model or DEFAULT_MODEL)
        items = response.get("items", [])
        if not isinstance(items, list):
            raise AIServiceError("Model response must include list field 'items'.")
        by_id = {item.get("id"): item for item in items if isinstance(item, dict)}

        for word in chunk:
            processed += 1
            item = by_id.get(word.id)
            if not item:
                continue

            suggested_hint = sanitize_text(str(item.get("hint", "")))
            suggested_difficulty = sanitize_text(str(item.get("difficulty", ""))).lower()
            final_hint = word.hint
            final_difficulty = word.difficulty
            changed = False
            if not word.hint and suggested_hint:
                final_hint = suggested_hint
                changed = True
            if (
                not word.difficulty
                and suggested_difficulty in {Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD}
            ):
                final_difficulty = suggested_difficulty
                changed = True
            if changed:
                staged_rows.append(
                    {
                        "word": word.sanitized_text,
                        "word_type": word.word_type,
                        "category": word.category.name if word.category else "",
                        "collection": word.collection.name if word.collection else "Base",
                        "subcategory": word.subcategory,
                        "hint": final_hint,
                        "difficulty": final_difficulty,
                    }
                )
                suggested += 1

    if not staged_rows:
        return {"processed": processed, "suggested": 0, "batches": batches, "batch_id": None, "staged_rows": 0}

    batch = create_batch_from_rows(
        rows=staged_rows,
        source_name=f"ai_complete_{datetime.now(tz=timezone.utc).strftime('%Y%m%d_%H%M%S')}.json",
        created_by=created_by,
        note="AI template completion suggestions staged for review.",
    )
    return {
        "processed": processed,
        "suggested": suggested,
        "batches": batches,
        "batch_id": batch.id,
        "staged_rows": batch.total_rows,
    }


def generate_words(
    *,
    word_type: str,
    category: str = "",
    subcategory: str = "",
    difficulty: str = "",
    collection: str = "Base",
    count: int = 20,
    model: str | None = None,
    created_by=None,
) -> dict:
    if count < 1:
        count = 1
    if count > MAX_AI_BATCH:
        count = MAX_AI_BATCH

    allowed_categories = _allowed_category_map()
    allowed_collections = _allowed_collection_map()
    requested_category = sanitize_text(category)
    requested_collection = sanitize_text(collection) or "Base"
    canonical_requested_category = allowed_categories.get(requested_category.casefold(), "")
    canonical_requested_collection = allowed_collections.get(
        requested_collection.casefold(), "Base"
    )
    if word_type == "guessing" and requested_category and not canonical_requested_category:
        allowed_display = ", ".join(sorted(allowed_categories.values())) or "(none configured)"
        raise AIServiceError(
            f"Category '{requested_category}' is not an active schema category. "
            f"Allowed categories: {allowed_display}."
        )

    system_prompt = (
        "You generate words for party games. Return strict JSON only. "
        "Return exactly the requested number of unique items. "
        "For guessing words, category must be one of allowed categories."
    )
    request_spec = {
        "count": count,
        "word_type": word_type,
        "category": canonical_requested_category or requested_category,
        "subcategory": subcategory,
        "difficulty": difficulty,
        "collection": canonical_requested_collection,
        "allowed_categories": list(allowed_categories.values()),
        "allowed_collections": list(allowed_collections.values()) or ["Base"],
    }
    user_prompt = (
        "Generate word entries for staging.\n"
        "Output JSON: {\"items\":[{\"word\":str,\"word_type\":str,\"category\":str,"
        "\"subcategory\":str,\"hint\":str,\"difficulty\":str,\"collection\":str}]}\n"
        f"Spec:\n{json.dumps(request_spec, ensure_ascii=False)}"
    )
    response = _chat_json(system_prompt=system_prompt, user_prompt=user_prompt, model=model or DEFAULT_MODEL)
    items = response.get("items", [])
    if not isinstance(items, list):
        raise AIServiceError("Model response must include list field 'items'.")

    normalized_rows = []
    skipped_invalid_category = 0
    for item in items[:count]:
        if not isinstance(item, dict):
            continue
        candidate_word_type = sanitize_text(str(item.get("word_type", word_type))).lower() or word_type
        candidate_word_type = "guessing" if candidate_word_type not in {"guessing", "describing"} else candidate_word_type

        raw_category = sanitize_text(str(item.get("category", canonical_requested_category or requested_category)))
        if candidate_word_type == "guessing":
            if canonical_requested_category:
                canonical_category = canonical_requested_category
            else:
                canonical_category = allowed_categories.get(raw_category.casefold(), "")
            if not canonical_category:
                skipped_invalid_category += 1
                continue
        else:
            canonical_category = allowed_categories.get(raw_category.casefold(), raw_category)

        raw_collection = sanitize_text(str(item.get("collection", canonical_requested_collection)))
        canonical_collection = allowed_collections.get(raw_collection.casefold(), canonical_requested_collection or "Base")

        normalized_rows.append(
            {
                "word": sanitize_text(str(item.get("word", ""))),
                "word_type": candidate_word_type,
                "category": canonical_category,
                "subcategory": sanitize_text(str(item.get("subcategory", subcategory))),
                "hint": sanitize_text(str(item.get("hint", ""))),
                "difficulty": sanitize_text(str(item.get("difficulty", difficulty))).lower(),
                "collection": canonical_collection,
            }
        )

    if not normalized_rows:
        return {"requested": count, "generated": 0, "batch_id": None, "skipped_invalid_category": skipped_invalid_category}

    batch = create_batch_from_rows(
        rows=normalized_rows,
        source_name=f"ai_generate_{datetime.now(tz=timezone.utc).strftime('%Y%m%d_%H%M%S')}.json",
        created_by=created_by,
        note="AI generated words via management interface.",
    )
    return {
        "requested": count,
        "generated": len(normalized_rows),
        "batch_id": batch.id,
        "skipped_invalid_category": skipped_invalid_category,
    }
