"""LLM-assisted music arrangement analysis via Claude Code CLI."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from typing import Any


def extract_json_object(raw_text: str) -> dict[str, Any]:
    """Extract the first valid JSON object from a free-form LLM response."""
    text = (raw_text or "").strip()
    if not text:
        raise ValueError("LLM response was empty.")

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

    raise ValueError("LLM response did not contain a valid JSON object.")


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


def build_arrangement_prompt(track_summary: dict[str, Any], song_info: str = "") -> str:
    """Build a prompt asking for arrangement-centric structured output."""
    song_info_block = ""
    if song_info:
        song_info_block = (
            f"\n用户提供的歌曲信息:\n{song_info}\n\n"
            "请根据上述歌曲信息填写 artist、album、credits 字段。"
            "同时利用你对该歌曲/艺人的知识来校准 style_tags 和 mood_tags，使之符合真实的风格分类而非仅靠音频特征猜测。\n\n"
        )

    return (
        "你是一位严谨的音乐编曲与制作分析师。\n"
        "你没有直接听到原始音频，只能根据下方提供的音频分析摘要来推断，不确定的地方请如实说明。\n"
        "返回一个 JSON 对象，不要使用 markdown 格式。\n\n"
        + song_info_block +
        "所有文本字段使用中文撰写。英语音乐专业术语（如 BPM、reverb、sidechain、pad 等）\n"
        "保留英文并在括号中附中文释义，例如\"sidechain（侧链压缩）\"。\n"
        "style_tags 和 mood_tags 用中文，必要时附英文原词。\n\n"
        "Required schema:\n"
        "{\n"
        '  "artist": "艺人名（如提供了歌曲信息则填写，否则省略此字段）",\n'
        '  "album": "专辑名与年份（如提供了歌曲信息则填写，否则省略此字段）",\n'
        '  "credits": "词曲作者/编曲/厂牌（如提供了歌曲信息则填写，否则省略此字段）",\n'
        '  "summary": "1-2 句编曲概述",\n'
        '  "style_tags": ["标签"],\n'
        '  "mood_tags": ["标签"],\n'
        '  "hook_moment": "简短描述",\n'
        '  "climax_moment": "简短描述",\n'
        '  "listening_focus": [\n'
        '    {"text": "聆听提示文本", "time": 72.5}\n'
        '  ],\n'
        '  "_listening_focus_note": "每条 listening_focus 必须包含 text（描述）和 time（秒数，对应 track summary 中的时间戳）",\n'
        '  "mix_highlights": ["具体的混音制作说明"],\n'
        '  "sections": [\n'
        "    {\n"
        '      "name": "前奏（Intro）",\n'
        '      "time_start": 0.0,\n'
        '      "time_end": 12.5,\n'
        '      "function": "这个段落的功能",\n'
        '      "energy": "low|medium|high",\n'
        '      "primary_stems": ["vocals", "bass"],\n'
        '      "arrangement_notes": ["具体编曲说明"],\n'
        '      "transition": "如何过渡到下一段"\n'
        "    }\n"
        "  ],\n"
        '  "stem_roles": {\n'
        '    "vocals": {"role": "该轨的作用", "timbre": "音色特征", "arrangement": "编曲中的使用方式"}\n'
        "  }\n"
        "}\n\n"
        "规则:\n"
        "- 使用具体的编曲语言：层次进入、密度（density）、音域（register）、声场宽度、律动（groove）、释放（release）。\n"
        "- 严格基于提供的时间戳和音轨名称。\n"
        "- 如果未提供歌曲信息，不要编造艺人信息。\n"
        "- 每个字段保持简洁。\n"
        "- summary 不超过 60 字。\n"
        "- 使用 3-4 个 style_tags 和 3-4 个 mood_tags。\n"
        "- 使用 3-5 个 listening_focus 条目（每条必须是 {text, time} 对象，time 为秒数）和 3-5 个 mix_highlights 条目。\n"
        "- 每个 arrangement_notes 列表 1-3 条。\n"
        "- stem_roles 中每个字段控制在卡片展示长度内。\n\n"
        f"Track summary:\n{json.dumps(track_summary, ensure_ascii=False, indent=2)}"
    )


def _find_claude_cli() -> str:
    """Locate the claude CLI binary."""
    path = shutil.which("claude")
    if path:
        return path
    for candidate in ("claude.cmd", "claude.exe"):
        path = shutil.which(candidate)
        if path:
            return path
    raise FileNotFoundError(
        "Claude Code CLI not found in PATH. "
        "Install with: npm install -g @anthropic-ai/claude-code"
    )


def analyze_arrangement_with_claude_code(
    track_summary: dict[str, Any],
    timeout: int = 180,
    song_info: str = "",
) -> dict[str, Any]:
    """Call Claude Code CLI in print mode for arrangement commentary.

    Pipes the arrangement prompt via stdin to ``claude -p``,
    parses the JSON response, and returns the structured result.
    """
    claude_bin = _find_claude_cli()
    prompt = build_arrangement_prompt(track_summary, song_info=song_info)

    try:
        result = subprocess.run(
            [claude_bin, "-p"],
            input=prompt,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            env={**os.environ, "CLAUDE_CODE_DISABLE_NONESSENTIAL": "1"},
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"Claude Code CLI timed out after {timeout}s")

    if result.returncode != 0:
        stderr_snippet = (result.stderr or "")[:500]
        raise RuntimeError(f"Claude Code CLI exited {result.returncode}: {stderr_snippet}")

    response_text = result.stdout.strip()
    if not response_text:
        raise RuntimeError("Claude Code CLI returned no output.")

    data = extract_json_object(response_text)
    data.setdefault("source", "claude-code")
    return data
