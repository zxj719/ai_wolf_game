"""MiniMax-assisted music arrangement analysis helpers."""

from __future__ import annotations

import json
import os
import re
from typing import Any
from urllib import error, request

DEFAULT_MINIMAX_API_URL = "https://api.minimaxi.com/anthropic/v1/messages"
DEFAULT_MINIMAX_MODEL = "MiniMax-M2.7"


def extract_json_object(raw_text: str) -> dict[str, Any]:
    """Extract the first valid JSON object from a free-form model response."""
    text = (raw_text or "").strip()
    if not text:
        raise ValueError("MiniMax response was empty.")

    candidates: list[str] = []

    fence_match = re.search(r"```json\s*(\{[\s\S]*?\})\s*```", text, flags=re.IGNORECASE)
    if fence_match:
        candidates.append(fence_match.group(1))

    brace_match = re.search(r"\{[\s\S]*\}", text)
    if brace_match:
        candidates.append(brace_match.group(0))

    if text.startswith("{") and text.endswith("}"):
        candidates.append(text)

    for candidate in candidates:
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            return data

    raise ValueError("MiniMax response did not contain a valid JSON object.")


def build_track_summary(
    analysis: dict[str, Any],
    stems_available: list[str],
) -> dict[str, Any]:
    """Condense local audio analysis into a prompt-friendly arrangement summary."""
    structures_raw = analysis.get("section_arrangement") or []
    structures = []
    if not structures_raw:
        for index, section in enumerate(analysis.get("structure", []), start=1):
            structures.append(
                {
                    "index": index,
                    "name": section.get("name") or section.get("label") or f"Section {index}",
                    "time_start": section.get("time_start", 0.0),
                    "time_end": section.get("time_end", 0.0),
                    "energy_level": section.get("energy_level", ""),
                    "active_stems": section.get("active_stems", []),
                }
            )
    else:
        for index, section in enumerate(structures_raw, start=1):
            structures.append(
                {
                    "index": section.get("index", index),
                    "name": section.get("name") or section.get("label") or f"Section {index}",
                    "time_start": section.get("time_start", 0.0),
                    "time_end": section.get("time_end", 0.0),
                    "energy_level": section.get("energy_level", ""),
                    "density": section.get("density"),
                    "active_stems": list(section.get("active_stems", []))[:5],
                }
            )

    stem_snapshot = {}
    all_stems = analysis.get("stems", {})
    for stem in stems_available:
        stats = all_stems.get(stem, {})
        stem_snapshot[stem] = {
            "peak_db": stats.get("peak_db"),
            "rms_db": stats.get("rms_db"),
            "freq_range": stats.get("freq_range"),
            "panning": stats.get("panning"),
        }

    return {
        "bpm": analysis.get("bpm"),
        "duration": analysis.get("duration"),
        "key": analysis.get("key"),
        "available_stems": stems_available,
        "structure_count": len(analysis.get("structure", [])),
        "sections": structures,
        "stems": stem_snapshot,
        "drum_pattern": analysis.get("drum_pattern", {}),
        "bass_note_count": len(analysis.get("bass_notes", [])),
    }


def build_arrangement_prompt(track_summary: dict[str, Any]) -> str:
    """Build a prompt that asks MiniMax for arrangement-centric structured output."""
    return (
        "You are a meticulous music arranger and production analyst.\n"
        "You are NOT listening to raw audio directly. You must infer from the provided "
        "audio-analysis summary only, and stay honest about uncertainty.\n"
        "Return one JSON object and no markdown.\n\n"
        "Required schema:\n"
        "{\n"
        '  "summary": "1-2 sentence arrangement overview",\n'
        '  "style_tags": ["tag"],\n'
        '  "mood_tags": ["tag"],\n'
        '  "hook_moment": "short string",\n'
        '  "climax_moment": "short string",\n'
        '  "listening_focus": ["specific listening cue"],\n'
        '  "mix_highlights": ["specific production note"],\n'
        '  "sections": [\n'
        "    {\n"
        '      "name": "Intro",\n'
        '      "time_start": 0.0,\n'
        '      "time_end": 12.5,\n'
        '      "function": "what the section does",\n'
        '      "energy": "low|medium|high",\n'
        '      "primary_stems": ["vocals", "bass"],\n'
        '      "arrangement_notes": ["specific note"],\n'
        '      "transition": "how it moves into the next section"\n'
        "    }\n"
        "  ],\n"
        '  "stem_roles": {\n'
        '    "vocals": {"role": "what it contributes", "timbre": "sonic character", "arrangement": "how it is deployed"}\n'
        "  }\n"
        "}\n\n"
        "Rules:\n"
        "- Prefer concrete arrangement language: layer entry, density, register, width, groove, release.\n"
        "- Stay tied to the supplied timing and stem names.\n"
        "- Do not invent lyrics, artist facts, or unsupported harmonic details.\n"
        "- Keep each string concise.\n"
        "- Keep summary under 45 words.\n"
        "- Use 3-4 style_tags and 3-4 mood_tags.\n"
        "- Use 3-5 listening_focus items and 3-5 mix_highlights items.\n"
        "- Keep each arrangement_notes list to 1-3 bullets.\n"
        "- Keep each role/timbre/arrangement field short enough for UI cards.\n\n"
        f"Track summary:\n{json.dumps(track_summary, ensure_ascii=False, indent=2)}"
    )


def _collect_text_blocks(payload: dict[str, Any]) -> str:
    """Collect text content from an Anthropic-compatible response."""
    content = payload.get("content", [])
    chunks: list[str] = []
    if isinstance(content, list):
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                chunks.append(str(item.get("text", "")))
    elif isinstance(content, str):
        chunks.append(content)
    return "\n".join(chunk for chunk in chunks if chunk)


def analyze_arrangement_with_minimax(
    track_summary: dict[str, Any],
    api_key: str | None = None,
    api_url: str | None = None,
    model: str | None = None,
    timeout: int = 120,
) -> dict[str, Any]:
    """Call MiniMax's Anthropic-compatible text endpoint for arrangement commentary."""
    api_key = api_key or os.getenv("MINIMAX_API_KEY")
    if not api_key:
        raise ValueError("MINIMAX_API_KEY is required for MiniMax analysis.")

    endpoint = api_url or os.getenv("MINIMAX_API_URL") or DEFAULT_MINIMAX_API_URL
    chosen_model = model or os.getenv("MINIMAX_MODEL") or DEFAULT_MINIMAX_MODEL
    prompt = build_arrangement_prompt(track_summary)
    headers = {
        "content-type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
    }
    last_error: Exception | None = None
    for max_tokens in (3000, 3600):
        body = {
            "model": chosen_model,
            "max_tokens": max_tokens,
            "temperature": 0.2,
            # MiniMax may still return thinking blocks; we only consume text blocks.
            "thinking": {"type": "disabled"},
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        }
        data = json.dumps(body).encode("utf-8")
        req = request.Request(
            endpoint,
            data=data,
            headers=headers,
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=timeout) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            response_text = _collect_text_blocks(payload)
            if not response_text:
                raise RuntimeError("MiniMax API returned no text content.")
            result = extract_json_object(response_text)
            result.setdefault("source", "minimax")
            result.setdefault("model", chosen_model)
            return result
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            last_error = RuntimeError(
                f"MiniMax API request failed: HTTP {exc.code} {detail}"
            )
        except error.URLError as exc:
            last_error = RuntimeError(f"MiniMax API request failed: {exc.reason}")
        except (RuntimeError, ValueError) as exc:
            last_error = exc

    assert last_error is not None
    raise last_error
