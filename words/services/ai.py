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

from words.models import Difficulty, WordEntry
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


def complete_word_templates(
    *,
    word_ids: list[int] | None = None,
    model: str | None = None,
    limit: int | None = None,
) -> dict:
    queryset = WordEntry.objects.filter(is_active=True).select_related("category", "collection")
    if word_ids:
        queryset = queryset.filter(id__in=word_ids)
    filtered = queryset.filter(Q(hint="") | Q(difficulty="")).order_by("id")
    if limit is not None and limit > 0:
        filtered = filtered[:limit]
    words = list(filtered)
    updated = 0
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
            changed = False
            suggested_hint = sanitize_text(str(item.get("hint", "")))
            suggested_difficulty = sanitize_text(str(item.get("difficulty", ""))).lower()
            if not word.hint and suggested_hint:
                word.hint = suggested_hint
                changed = True
            if (
                not word.difficulty
                and suggested_difficulty in {Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD}
            ):
                word.difficulty = suggested_difficulty
                changed = True
            if changed:
                word.save(update_fields=["hint", "difficulty", "updated_at"])
                updated += 1

    return {"processed": processed, "updated": updated, "batches": batches}


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

    system_prompt = (
        "You generate words for party games. Return strict JSON only. "
        "Return exactly the requested number of unique items."
    )
    request_spec = {
        "count": count,
        "word_type": word_type,
        "category": category,
        "subcategory": subcategory,
        "difficulty": difficulty,
        "collection": collection or "Base",
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
    for item in items[:count]:
        if not isinstance(item, dict):
            continue
        normalized_rows.append(
            {
                "word": sanitize_text(str(item.get("word", ""))),
                "word_type": sanitize_text(str(item.get("word_type", word_type))) or word_type,
                "category": sanitize_text(str(item.get("category", category))),
                "subcategory": sanitize_text(str(item.get("subcategory", subcategory))),
                "hint": sanitize_text(str(item.get("hint", ""))),
                "difficulty": sanitize_text(str(item.get("difficulty", difficulty))).lower(),
                "collection": sanitize_text(str(item.get("collection", collection or "Base"))) or "Base",
            }
        )

    batch = create_batch_from_rows(
        rows=normalized_rows,
        source_name=f"ai_generate_{datetime.now(tz=timezone.utc).strftime('%Y%m%d_%H%M%S')}.json",
        created_by=created_by,
        note="AI generated words via management interface.",
    )
    return {"requested": count, "generated": len(normalized_rows), "batch_id": batch.id}
