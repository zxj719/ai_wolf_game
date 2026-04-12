"""Generate HTML stem player with analysis visualizations."""

import html as html_lib
import json
import os

STEM_COLORS = {
    "vocals": "#e94560", "drums": "#f59e0b",
    "bass": "#10b981", "other": "#6366f1",
    "guitar": "#84cc16", "piano": "#06b6d4",
    "vocal_soprano": "#ff6b9d", "vocal_alto": "#c084fc",
    "vocal_tenor": "#fb923c", "vocal_bass": "#67e8f9",
    "vocal_lead": "#e94560", "vocal_harmony": "#c084fc",
    "vocal_high": "#ff6b9d", "vocal_mid": "#c084fc", "vocal_low": "#67e8f9",
}
STEM_LABELS = {
    "vocals": "Vocals", "drums": "Drums",
    "bass": "Bass", "other": "Other",
    "guitar": "Guitar", "piano": "Piano",
    "vocal_soprano": "Soprano", "vocal_alto": "Alto",
    "vocal_tenor": "Tenor", "vocal_bass": "Bass Voice",
    "vocal_lead": "Lead Vocal", "vocal_harmony": "Harmony",
    "vocal_high": "High Voice", "vocal_mid": "Mid Voice", "vocal_low": "Low Voice",
}


def _compact_events(events):
    """Strip nulls, false values, and shorten keys for HTML embedding."""
    if isinstance(events, dict):
        # Drum events: dict of band -> list
        return {
            band: [_compact_one(e) for e in evts]
            for band, evts in events.items()
        }
    return [_compact_one(e) for e in events]


def _compact_one(e: dict) -> dict:
    """Remove null/false fields; keep only meaningful expression data."""
    out = {}
    for k, v in e.items():
        if v is None or v is False:
            continue
        # Shorten vibrato to just presence flag for HTML
        if k == "vibrato" and isinstance(v, dict):
            out["vib"] = 1
            continue
        # Shorten pitch_bend
        if k == "pitch_bend" and isinstance(v, dict):
            out["bend"] = v.get("type", "")[0:2]  # "sl", "be"
            continue
        # Shorten trill_info
        if k == "trill_info":
            continue  # already have ornament=trill
        # Drop slur_group numbers (just keep presence)
        if k == "slur_group":
            out["slur"] = 1
            continue
        # Abbreviate keys
        short = {"articulation": "art", "ornament": "orn",
                 "syncopation": "syn", "velocity": "vel",
                 "duration": "dur", "pitches": "p",
                 "ghost_note": "gh"}.get(k, k)
        out[short] = v
    return out


def _fmt_clock(seconds: float | int | None) -> str:
    """Format seconds as M:SS."""
    if seconds is None:
        return "0:00"
    total = max(0, int(round(float(seconds))))
    minutes, secs = divmod(total, 60)
    return f"{minutes}:{secs:02d}"


def _render_text_list(items: list[str], class_name: str, empty_text: str) -> str:
    """Render a simple escaped unordered list."""
    if not items:
        return f'<div class="{class_name} empty">{html_lib.escape(empty_text)}</div>'
    list_items = "".join(
        f"<li>{html_lib.escape(str(item))}</li>"
        for item in items
        if str(item).strip()
    )
    if not list_items:
        return f'<div class="{class_name} empty">{html_lib.escape(empty_text)}</div>'
    return f'<ul class="{class_name}">{list_items}</ul>'


def _render_chip_row(values: list[str]) -> str:
    """Render a row of compact chips."""
    chips = "".join(
        f'<span class="chip">{html_lib.escape(str(value))}</span>'
        for value in values
        if str(value).strip()
    )
    return f'<div class="chip-row">{chips}</div>' if chips else ""


def _render_arrangement_panel(arrangement: dict | None) -> str:
    """Render Minimax-assisted arrangement insights."""
    if not arrangement:
        return ""

    style_tags = arrangement.get("style_tags", [])
    mood_tags = arrangement.get("mood_tags", [])
    listening_focus = arrangement.get("listening_focus", [])
    mix_highlights = arrangement.get("mix_highlights", [])
    sections = arrangement.get("sections", [])
    stem_roles = arrangement.get("stem_roles", {})
    summary = html_lib.escape(str(arrangement.get("summary", "")).strip())
    hook_moment = str(arrangement.get("hook_moment", "")).strip()
    climax_moment = str(arrangement.get("climax_moment", "")).strip()
    source = html_lib.escape(str(arrangement.get("source", "")).strip())
    model = html_lib.escape(str(arrangement.get("model", "")).strip())

    meta_bits = []
    if source:
        meta_bits.append(source.title())
    if model:
        meta_bits.append(model)
    meta_line = " · ".join(meta_bits)

    section_cards = ""
    for sec in sections:
        stem_list = ", ".join(STEM_LABELS.get(stem, stem) for stem in sec.get("primary_stems", []))
        note_list = _render_text_list(
            [str(note) for note in sec.get("arrangement_notes", [])],
            "mini-list",
            "No arrangement notes.",
        )
        timing = f'{_fmt_clock(sec.get("time_start"))} - {_fmt_clock(sec.get("time_end"))}'
        chips = _render_chip_row([sec.get("energy", ""), stem_list])
        transition = str(sec.get("transition", "")).strip()
        section_cards += f"""
        <article class="section-card">
          <div class="section-head">
            <div>
              <div class="section-name">{html_lib.escape(str(sec.get("name", "Section")))}</div>
              <div class="section-time">{html_lib.escape(timing)}</div>
            </div>
            <div class="section-function">{html_lib.escape(str(sec.get("function", "")).strip())}</div>
          </div>
          {chips}
          {note_list}
          <div class="section-transition">{html_lib.escape(transition)}</div>
        </article>"""
    if not section_cards:
        section_cards = '<div class="empty">MiniMax did not return section-level notes.</div>'

    role_cards = ""
    for stem_name, payload in stem_roles.items():
        role = html_lib.escape(str(payload.get("role", "")).strip())
        timbre = html_lib.escape(str(payload.get("timbre", "")).strip())
        arrangement_note = html_lib.escape(str(payload.get("arrangement", "")).strip())
        if not any([role, timbre, arrangement_note]):
            continue
        role_cards += f"""
        <article class="role-card">
          <div class="role-name" style="color:{STEM_COLORS.get(stem_name, '#d0d0e0')}">{html_lib.escape(STEM_LABELS.get(stem_name, stem_name))}</div>
          <div class="role-copy">{role}</div>
          <div class="role-copy subtle">{timbre}</div>
          <div class="role-copy subtle">{arrangement_note}</div>
        </article>"""
    if not role_cards:
        role_cards = '<div class="empty">No stem-role commentary returned.</div>'

    hook_html = (
        f'<div class="callout"><span class="callout-label">Hook</span>{html_lib.escape(hook_moment)}</div>'
        if hook_moment else ""
    )
    climax_html = (
        f'<div class="callout"><span class="callout-label">Climax</span>{html_lib.escape(climax_moment)}</div>'
        if climax_moment else ""
    )

    return f"""
<section class="arrangement-shell">
  <div class="panel hero-panel">
    <div class="panel-title">Arrangement Map</div>
    <div class="hero-copy">{summary}</div>
    {_render_chip_row(style_tags)}
    {_render_chip_row(mood_tags)}
    <div class="meta-line">{meta_line}</div>
    <div class="callout-grid">
      {hook_html}
      {climax_html}
    </div>
  </div>
  <div class="analysis-grid">
    <div class="panel">
      <div class="panel-title">Listening Focus</div>
      {_render_text_list([str(item) for item in listening_focus], "insight-list", "No listening prompts available.")}
    </div>
    <div class="panel">
      <div class="panel-title">Mix Highlights</div>
      {_render_text_list([str(item) for item in mix_highlights], "insight-list", "No mix notes available.")}
    </div>
  </div>
  <div class="panel">
    <div class="panel-title">Section Notes</div>
    <div class="section-grid">{section_cards}</div>
  </div>
  <div class="panel">
    <div class="panel-title">Stem Roles</div>
    <div class="role-grid">{role_cards}</div>
  </div>
</section>"""


def generate_stem_player(
    stem_paths: dict[str, str],
    original_path: str,
    output_path: str,
    analysis: dict | None = None,
    resynth_data: dict | None = None,
) -> None:
    output_dir = os.path.dirname(output_path)
    stem_rels = {}
    for name, path in stem_paths.items():
        stem_rels[name] = os.path.relpath(path, output_dir).replace("\\", "/")

    # Build sample paths for resynth
    sample_rels = {}
    if resynth_data:
        for stem_name, data in resynth_data.items():
            samples = data.get("samples", {})
            if isinstance(samples, str):
                sample_rels[stem_name] = os.path.relpath(samples, output_dir).replace("\\", "/")
            elif isinstance(samples, dict):
                sample_rels[stem_name] = {}
                for k, v in samples.items():
                    sample_rels[stem_name][k] = os.path.relpath(v, output_dir).replace("\\", "/")

    original_rel = os.path.relpath(original_path, output_dir).replace("\\", "/")
    analysis_json = json.dumps(analysis or {}, ensure_ascii=False)

    # Prepare resynth events (compact for embedding)
    resynth_events = {}
    if resynth_data:
        for stem_name, data in resynth_data.items():
            events = data.get("events", [])
            resynth_events[stem_name] = _compact_events(events)
    resynth_json = json.dumps(resynth_events, ensure_ascii=False, separators=(',', ':'))
    sample_rels_json = json.dumps(sample_rels, ensure_ascii=False)

    stem_order = [
        "vocals",
        "vocal_lead", "vocal_soprano", "vocal_alto", "vocal_tenor", "vocal_bass",
        "vocal_high", "vocal_mid", "vocal_low", "vocal_harmony",
        "drums", "bass", "guitar", "piano", "other",
    ]
    stems_available = [s for s in stem_order if s in stem_rels]

    stem_audio_tags = "\n".join(
        f'<audio id="stem_{s}" src="{stem_rels[s]}" preload="auto"></audio>'
        for s in stems_available
    )

    def stem_stat_html(name, stats):
        if not stats:
            return ""
        pan_label = "C"
        p = stats.get("panning", 0)
        if p < -0.1: pan_label = f"L{int(abs(p)*100)}"
        elif p > 0.1: pan_label = f"R{int(abs(p)*100)}"
        fr = stats.get("freq_range", [0, 0])
        return (f'<span class="stat">Peak {stats.get("peak_db",0):.0f}dB</span>'
                f'<span class="stat">RMS {stats.get("rms_db",0):.0f}dB</span>'
                f'<span class="stat">Pan {pan_label}</span>'
                f'<span class="stat">{fr[0]}-{fr[1]}Hz</span>')

    stem_rows = ""
    for s in stems_available:
        color = STEM_COLORS.get(s, "#888")
        label = STEM_LABELS.get(s, s)
        stats = (analysis or {}).get("stems", {}).get(s, {})
        stat_html = stem_stat_html(s, stats)
        stem_rows += f"""
    <div class="stem-row" data-stem="{s}">
      <div class="stem-header">
        <span class="stem-label" style="color:{color}">{label}</span>
        <div class="stem-btns">
          <button class="btn mute-btn" data-stem="{s}">M</button>
          <button class="btn solo-btn" data-stem="{s}">S</button>
          <input type="range" class="vol-slider" data-stem="{s}" min="0" max="100" value="100">
        </div>
      </div>
      <div class="stem-viz">
        <canvas class="vu-meter" data-stem="{s}" width="6" height="60"></canvas>
        <canvas class="waveform" data-stem="{s}" height="50"></canvas>
        <canvas class="spectrum" data-stem="{s}" width="120" height="50"></canvas>
      </div>
      <div class="stem-stats">{stat_html}</div>
    </div>"""

    # Song info panel
    a = analysis or {}
    bpm = a.get("bpm", "?")
    key_info = a.get("key", {})
    key_str = f'{key_info.get("key","?")} {key_info.get("mode","")}'
    duration = a.get("duration", 0)
    dur_min = int(duration // 60)
    dur_sec = int(duration % 60)

    # Structure timeline
    structure = a.get("structure", [])
    structure_json = json.dumps(structure, ensure_ascii=False)

    # Drum pattern
    drum_pattern = a.get("drum_pattern", {})
    drum_json = json.dumps(drum_pattern, ensure_ascii=False)

    # Bass notes
    bass_notes = a.get("bass_notes", [])
    bass_json = json.dumps(bass_notes[:500], ensure_ascii=False)  # limit for performance

    arrangement = a.get("arrangement", {})
    arrangement_panel_html = _render_arrangement_panel(arrangement)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Stem Analyzer</title>
<style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ font-family:'IBM Plex Sans','Segoe UI',sans-serif; background:
    radial-gradient(circle at top left, #1b2140 0%, #0b1122 38%, #06080f 100%);
    color:#d0d0e0; padding:16px; max-width:1100px; margin:0 auto; }}
h1 {{ font-family:'Space Grotesk','Avenir Next','Segoe UI',sans-serif; font-size:1.5em; color:#eef2ff; margin-bottom:4px; letter-spacing:0.01em; }}
.subtitle {{ font-size:0.75em; color:#404060; margin-bottom:16px; }}

/* Song Info */
.song-info {{ display:flex; gap:20px; padding:12px 16px; background:rgba(18,18,42,0.86); border-radius:8px; margin-bottom:12px; flex-wrap:wrap; border:1px solid rgba(95,123,178,0.18); box-shadow:0 16px 40px rgba(0,0,0,0.28); }}
.info-item {{ text-align:center; }}
.info-label {{ font-family:'Space Grotesk','Avenir Next','Segoe UI',sans-serif; font-size:0.6em; color:#6a7596; text-transform:uppercase; letter-spacing:1px; }}
.info-value {{ font-size:1.2em; font-weight:bold; color:#e0e0f0; }}

/* Transport */
.transport {{ display:flex; align-items:center; gap:10px; padding:12px 16px; background:rgba(18,18,42,0.86); border-radius:8px; margin-bottom:12px; border:1px solid rgba(95,123,178,0.18); box-shadow:0 16px 40px rgba(0,0,0,0.28); }}
.transport button {{ background:#e94560; color:#fff; border:none; border-radius:6px; padding:6px 18px; cursor:pointer; font-family:inherit; font-size:0.9em; }}
.transport button:hover {{ background:#c73650; }}
.seek-bar {{ flex:1; height:5px; -webkit-appearance:none; appearance:none; background:#1a1a3e; border-radius:3px; outline:none; cursor:pointer; }}
.seek-bar::-webkit-slider-thumb {{ -webkit-appearance:none; width:12px; height:12px; border-radius:50%; background:#e94560; cursor:pointer; }}
.time-display {{ font-size:0.8em; color:#808090; min-width:100px; text-align:right; }}

/* Structure Timeline */
.structure-bar {{ display:flex; height:24px; border-radius:4px; overflow:hidden; margin-bottom:12px; position:relative; }}
.structure-section {{ display:flex; align-items:center; justify-content:center; font-size:0.65em; font-weight:bold; color:rgba(255,255,255,0.8); cursor:pointer; transition:opacity 0.15s; border-right:1px solid #0a0a14; }}
.structure-section:hover {{ opacity:0.8; }}
.struct-colors {{ }}

/* AI Arrangement */
.arrangement-shell {{ margin-bottom:12px; }}
.hero-panel {{ border:1px solid #24304f; background:linear-gradient(135deg, #151a32 0%, #101525 65%, #1b2139 100%); }}
.hero-copy {{ font-size:1.02em; line-height:1.6; color:#eef2ff; margin-bottom:10px; }}
.chip-row {{ display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px; }}
.chip {{ display:inline-flex; align-items:center; padding:4px 10px; border-radius:999px; background:#0c1630; color:#b8c6f2; font-size:0.72em; letter-spacing:0.04em; text-transform:uppercase; }}
.meta-line {{ font-size:0.72em; color:#7e8cb8; margin-top:4px; }}
.analysis-grid {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px; margin-bottom:12px; }}
.callout-grid {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px; margin-top:10px; }}
.callout {{ padding:10px 12px; border-radius:8px; background:#0b1122; color:#dce6ff; line-height:1.5; }}
.callout-label {{ display:block; font-size:0.65em; color:#6d7da8; text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px; }}
.insight-list, .mini-list {{ list-style:none; display:grid; gap:8px; }}
.insight-list li, .mini-list li {{ position:relative; padding-left:14px; line-height:1.5; color:#d7def0; }}
.insight-list li::before, .mini-list li::before {{ content:''; position:absolute; left:0; top:0.62em; width:6px; height:6px; border-radius:50%; background:#e94560; }}
.section-grid {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px; }}
.section-card {{ padding:12px; border-radius:10px; background:#0b1122; border:1px solid #1d2740; }}
.section-head {{ display:grid; gap:6px; margin-bottom:8px; }}
.section-name {{ font-size:1em; font-weight:bold; color:#f8fafc; }}
.section-time {{ font-size:0.72em; color:#7e8cb8; letter-spacing:0.04em; }}
.section-function {{ color:#d7def0; line-height:1.45; }}
.section-transition {{ margin-top:8px; font-size:0.8em; color:#9fb0d9; }}
.role-grid {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; }}
.role-card {{ padding:12px; border-radius:10px; background:#0b1122; border:1px solid #1d2740; }}
.role-name {{ font-size:0.92em; font-weight:bold; margin-bottom:8px; }}
.role-copy {{ color:#d7def0; line-height:1.45; }}
.role-copy.subtle {{ color:#9fb0d9; margin-top:6px; }}
.empty {{ color:#7081ac; font-size:0.82em; }}

/* Stems */
.stems-container {{ background:rgba(18,18,42,0.86); border-radius:8px; padding:12px; margin-bottom:12px; border:1px solid rgba(95,123,178,0.18); box-shadow:0 16px 40px rgba(0,0,0,0.28); }}
.stem-row {{ padding:6px 0; border-bottom:1px solid #1a1a3e; }}
.stem-row:last-child {{ border-bottom:none; }}
.stem-header {{ display:flex; align-items:center; gap:8px; margin-bottom:4px; }}
.stem-label {{ font-family:'Space Grotesk','Avenir Next','Segoe UI',sans-serif; font-weight:bold; min-width:60px; font-size:0.85em; }}
.stem-btns {{ display:flex; align-items:center; gap:6px; }}
.btn {{ width:24px; height:24px; border:1px solid #303050; background:transparent; color:#707080; border-radius:3px; cursor:pointer; font-family:inherit; font-size:0.7em; font-weight:bold; }}
.btn:hover {{ border-color:#e94560; color:#e94560; }}
.btn.active {{ background:#e94560; color:#fff; border-color:#e94560; }}
.vol-slider {{ width:60px; height:3px; -webkit-appearance:none; appearance:none; background:#1a1a3e; border-radius:2px; outline:none; }}
.vol-slider::-webkit-slider-thumb {{ -webkit-appearance:none; width:10px; height:10px; border-radius:50%; background:#a0a0c0; cursor:pointer; }}
.stem-viz {{ display:flex; align-items:center; gap:4px; height:50px; }}
.vu-meter {{ width:6px; height:50px; border-radius:2px; background:#0a0a14; }}
.waveform {{ flex:1; height:50px; border-radius:3px; background:#0a0a14; }}
.spectrum {{ width:120px; height:50px; border-radius:3px; background:#0a0a14; }}
.stem-stats {{ display:flex; gap:8px; margin-top:2px; }}
.stat {{ font-size:0.6em; color:#505070; background:#0a0a14; padding:1px 6px; border-radius:2px; }}

/* Drum Grid */
.panel {{ background:rgba(18,18,42,0.86); border-radius:8px; padding:12px; margin-bottom:12px; border:1px solid rgba(95,123,178,0.18); box-shadow:0 16px 40px rgba(0,0,0,0.28); }}
.panel-title {{ font-family:'Space Grotesk','Avenir Next','Segoe UI',sans-serif; font-size:0.8em; color:#7e8cb8; margin-bottom:8px; text-transform:uppercase; letter-spacing:1px; }}
.drum-grid {{ position:relative; height:70px; }}
.drum-grid canvas {{ width:100%; height:100%; border-radius:3px; }}

/* Bass Line */
.bass-line {{ position:relative; height:60px; }}
.bass-line canvas {{ width:100%; height:100%; border-radius:3px; }}
.expression-view {{ position:relative; }}
.expression-view canvas {{ width:100%; height:120px; border-radius:3px; }}
.expr-controls {{ display:flex; align-items:center; gap:12px; margin-bottom:8px; font-size:0.75em; }}
.expr-controls select {{ background:#1a1a3e; color:#fff; border:1px solid #333; border-radius:4px; padding:3px 8px; font-size:1em; }}
.expr-legend {{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; color:#888; }}
.legend-dot {{ width:8px; height:8px; border-radius:50%; display:inline-block; margin-left:6px; }}
.expr-stats {{ font-size:0.7em; color:#606080; margin-top:6px; display:flex; gap:16px; flex-wrap:wrap; }}

.info-footer {{ font-size:0.65em; color:#303050; margin-top:8px; }}
.resynth-toggle {{ background:#2a2a4e !important; font-size:0.75em !important; padding:4px 10px !important; }}
.resynth-toggle.active {{ background:#10b981 !important; }}
.swap-panel {{ background:rgba(18,18,42,0.86); border-radius:8px; padding:12px; margin-bottom:12px; border:1px solid rgba(95,123,178,0.18); box-shadow:0 16px 40px rgba(0,0,0,0.28); }}
.swap-controls {{ display:flex; gap:12px; flex-wrap:wrap; }}
.swap-item {{ display:flex; align-items:center; gap:6px; font-size:0.8em; }}
.swap-item select {{ background:#0f1830; color:#d0d0e0; border:1px solid #303050; border-radius:4px; padding:2px 6px; font-family:inherit; font-size:0.9em; }}
</style>
</head>
<body>
<h1>Stem Analyzer</h1>
<div class="subtitle">Reverse-engineer the production. M = mute, S = solo. Toggle Resynth to hear AI reconstruction.</div>

{stem_audio_tags}

<div class="song-info">
  <div class="info-item"><div class="info-label">BPM</div><div class="info-value">{bpm}</div></div>
  <div class="info-item"><div class="info-label">Key</div><div class="info-value">{key_str}</div></div>
  <div class="info-item"><div class="info-label">Duration</div><div class="info-value">{dur_min}:{dur_sec:02d}</div></div>
  <div class="info-item"><div class="info-label">Stems</div><div class="info-value">{len(stems_available)}</div></div>
</div>

<div class="transport">
  <button id="playBtn">Play</button>
  <button id="resynthBtn" class="resynth-toggle" title="Toggle AI resynthesis playback">Resynth: OFF</button>
  <input type="range" class="seek-bar" id="seekBar" min="0" max="10000" value="0">
  <div class="time-display" id="timeDisplay">0:00 / 0:00</div>
</div>
<div class="swap-panel" id="swapPanel" style="display:none;">
  <div class="panel-title">Timbre Swap</div>
  <div class="swap-controls" id="swapControls"></div>
</div>

<div class="structure-bar" id="structureBar"></div>
{arrangement_panel_html}

<div class="stems-container">
{stem_rows}
</div>

<div class="panel">
  <div class="panel-title">Drum Pattern</div>
  <div class="drum-grid"><canvas id="drumCanvas"></canvas></div>
</div>

<div class="panel">
  <div class="panel-title">Bass Line</div>
  <div class="bass-line"><canvas id="bassCanvas"></canvas></div>
</div>

<div class="panel">
  <div class="panel-title">Expression & Articulation</div>
  <div class="expression-view">
    <div class="expr-controls">
      <select id="exprStemSelect">
        <option value="vocals">Vocals</option>
        <option value="bass">Bass</option>
      </select>
      <span class="expr-legend">
        <span class="legend-dot" style="background:#f59e0b"></span>Grace Notes
        <span class="legend-dot" style="background:#ef4444"></span>Syncopation
        <span class="legend-dot" style="background:#10b981"></span>Legato/Slur
        <span class="legend-dot" style="background:#8b5cf6"></span>Vibrato
        <span class="legend-dot" style="background:#06b6d4"></span>Pitch Bend
        <span class="legend-dot" style="background:#ec4899"></span>Trill
      </span>
    </div>
    <canvas id="exprCanvas"></canvas>
    <div class="expr-stats" id="exprStats"></div>
  </div>
</div>

<div class="info-footer" id="info"></div>

<script>
const STEMS = {json.dumps(stems_available)};
const COLORS = {json.dumps(STEM_COLORS)};
const analysis = {analysis_json};
const structure = {structure_json};
const drumPattern = {drum_json};
const bassNotes = {bass_json};

const audios = {{}};
let audioCtx = null;
const analysers = {{}};
const sources = {{}};
// VU meters / spectrum visualisations need createMediaElementSource, which
// permanently captures the <audio> element away from its default output. On
// file:// and in several other real-world conditions this produced silent
// playback, which is a much worse tradeoff than missing meters. We now leave
// the <audio> elements untouched and only create an AudioContext lazily for
// the resynth engine (which uses its own BufferSource nodes and does not
// capture the stem elements).
let webAudioOk = false;

STEMS.forEach(s => {{
    audios[s] = document.getElementById('stem_' + s);
}});

const playBtn = document.getElementById('playBtn');
const seekBar = document.getElementById('seekBar');
const timeDisplay = document.getElementById('timeDisplay');
let isPlaying = false, duration = 0, soloStem = null;
const readyMetadata = new Set();
let transportReady = false;

function fmt(t) {{ const m=Math.floor(t/60), s=Math.floor(t%60); return m+':'+String(s).padStart(2,'0'); }}

function tryInitTransport() {{
    if (transportReady || readyMetadata.size !== STEMS.length) return;
    const durations = STEMS
        .map(s => audios[s].duration)
        .filter(d => Number.isFinite(d) && d > 0);
    if (durations.length === 0) return;
    duration = Math.max(...durations);
    timeDisplay.textContent = '0:00 / ' + fmt(duration);
    drawAllWaveforms();
    drawDrumGrid();
    drawBassLine();
    drawStructure();
    if (typeof drawExpression === 'function') drawExpression();
    transportReady = true;
}}

function markMetadataReady(stem) {{
    const audio = audios[stem];
    if (!audio) return;
    if (Number.isFinite(audio.duration) && audio.duration > 0) {{
        readyMetadata.add(stem);
    }}
    tryInitTransport();
}}

STEMS.forEach(s => {{
    const audio = audios[s];
    audio.addEventListener('loadedmetadata', () => {{ markMetadataReady(s); }});
    audio.addEventListener('durationchange', () => {{ markMetadataReady(s); }});
}});

function bootstrapReadyMetadata() {{
    STEMS.forEach(s => {{
        const audio = audios[s];
        if (audio && audio.readyState >= 1) {{
            markMetadataReady(s);
        }}
    }});
}}

playBtn.addEventListener('click', () => {{
    if (isPlaying) {{
        STEMS.forEach(s => audios[s].pause());
        playBtn.textContent = 'Play';
    }} else {{
        const t = audios[STEMS[0]].currentTime;
        STEMS.forEach(s => {{
            audios[s].currentTime = t;
            const p = audios[s].play();
            if (p && typeof p.catch === 'function') {{
                p.catch(err => console.warn('play() rejected for', s, err));
            }}
        }});
        playBtn.textContent = 'Pause';
    }}
    isPlaying = !isPlaying;
}});

let isSeeking = false;
let seekLock = 0;  // timestamp of last seek, ignore timeupdate briefly after

seekBar.addEventListener('mousedown', () => {{ isSeeking = true; }});
seekBar.addEventListener('touchstart', () => {{ isSeeking = true; }});
seekBar.addEventListener('input', () => {{
    const t = (seekBar.value / 10000) * duration;
    seekLock = Date.now();
    STEMS.forEach(s => {{ audios[s].currentTime = t; }});
    timeDisplay.textContent = fmt(t) + ' / ' + fmt(duration);
}});
seekBar.addEventListener('mouseup', () => {{ isSeeking = false; }});
seekBar.addEventListener('touchend', () => {{ isSeeking = false; }});
seekBar.addEventListener('change', () => {{ isSeeking = false; }});

audios[STEMS[0]].addEventListener('timeupdate', () => {{
    // Ignore stale timeupdate events right after a seek
    if (isSeeking || Date.now() - seekLock < 300) return;
    const t = audios[STEMS[0]].currentTime;
    timeDisplay.textContent = fmt(t) + ' / ' + fmt(duration);
    seekBar.value = (t / duration) * 10000;
    updateStructureHighlight(t);
}});

// Volume
document.querySelectorAll('.vol-slider').forEach(slider => {{
    slider.addEventListener('input', () => {{ audios[slider.dataset.stem].volume = slider.value / 100; }});
}});

// Mute
document.querySelectorAll('.mute-btn').forEach(btn => {{
    btn.addEventListener('click', () => {{
        const a = audios[btn.dataset.stem];
        a.muted = !a.muted;
        btn.classList.toggle('active', a.muted);
    }});
}});

// Solo
document.querySelectorAll('.solo-btn').forEach(btn => {{
    btn.addEventListener('click', () => {{
        const stem = btn.dataset.stem;
        if (soloStem === stem) {{
            soloStem = null;
            STEMS.forEach(s => {{ audios[s].muted = false; }});
            document.querySelectorAll('.solo-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.mute-btn').forEach(b => b.classList.remove('active'));
        }} else {{
            soloStem = stem;
            STEMS.forEach(s => {{ audios[s].muted = (s !== stem); }});
            document.querySelectorAll('.solo-btn').forEach(b => b.classList.toggle('active', b.dataset.stem === stem));
            document.querySelectorAll('.mute-btn').forEach(b => b.classList.toggle('active', b.dataset.stem !== stem));
        }}
    }});
}});

audios[STEMS[0]].addEventListener('ended', () => {{ isPlaying=false; playBtn.textContent='Play'; }});

// === Waveform drawing ===
async function drawWaveform(stemName) {{
    const canvas = document.querySelector(`.waveform[data-stem="${{stemName}}"]`);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = canvas.offsetWidth, h = canvas.offsetHeight;

    try {{
        const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
        const resp = await fetch(audios[stemName].src);
        const buf = await resp.arrayBuffer();
        const decoded = await tempCtx.decodeAudioData(buf);
        const data = decoded.getChannelData(0);
        tempCtx.close();

        const step = Math.ceil(data.length / w);
        ctx.fillStyle = COLORS[stemName] || '#888';
        for (let i = 0; i < w; i++) {{
            let min = 1, max = -1;
            for (let j = 0; j < step; j++) {{
                const idx = i * step + j;
                if (idx < data.length) {{ if (data[idx] < min) min = data[idx]; if (data[idx] > max) max = data[idx]; }}
            }}
            ctx.fillRect(i, (1-max)*h/2, 1, Math.max(1, (max-min)*h/2));
        }}
    }} catch(e) {{ ctx.fillStyle='#202040'; ctx.fillRect(0,h/2,w,1); }}
}}
function drawAllWaveforms() {{ STEMS.forEach(s => drawWaveform(s)); }}

// === Real-time VU meter + Spectrum ===
function animateMeters() {{
    if (!webAudioOk) {{ requestAnimationFrame(animateMeters); return; }}
    STEMS.forEach(s => {{
        const analyser = analysers[s];
        if (!analyser) return;
        const bufLen = analyser.frequencyBinCount;
        const data = new Uint8Array(bufLen);

        // VU Meter
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < bufLen; i++) {{ const v = (data[i] - 128) / 128; sum += v * v; }}
        const rms = Math.sqrt(sum / bufLen);
        const vu = document.querySelector(`.vu-meter[data-stem="${{s}}"]`);
        if (vu) {{
            const ctx = vu.getContext('2d');
            const h = vu.height, w = vu.width;
            ctx.clearRect(0, 0, w, h);
            const level = Math.min(1, rms * 4);
            const grad = ctx.createLinearGradient(0, h, 0, 0);
            grad.addColorStop(0, COLORS[s] || '#888');
            grad.addColorStop(0.7, COLORS[s] || '#888');
            grad.addColorStop(1, '#ff4444');
            ctx.fillStyle = grad;
            ctx.fillRect(0, h * (1 - level), w, h * level);
        }}

        // Spectrum
        analyser.getByteFrequencyData(data);
        const spec = document.querySelector(`.spectrum[data-stem="${{s}}"]`);
        if (spec) {{
            const ctx = spec.getContext('2d');
            const w = spec.width, h = spec.height;
            ctx.clearRect(0, 0, w, h);
            const barW = w / bufLen * 2;
            const color = COLORS[s] || '#888';
            for (let i = 0; i < bufLen / 2; i++) {{
                const barH = (data[i] / 255) * h;
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.7;
                ctx.fillRect(i * barW, h - barH, barW - 1, barH);
            }}
            ctx.globalAlpha = 1;
        }}
    }});
    requestAnimationFrame(animateMeters);
}}
animateMeters();

// === Structure timeline ===
function drawStructure() {{
    const bar = document.getElementById('structureBar');
    if (!structure || structure.length === 0) {{ bar.style.display = 'none'; return; }}
    const colors = ['#e94560','#f59e0b','#10b981','#6366f1','#ec4899','#8b5cf6','#06b6d4','#84cc16'];
    const nameColors = {{'Intro':'#64748b','Verse':'#10b981','Chorus':'#e94560',
        'Pre-Chorus':'#f59e0b','Bridge':'#6366f1','Outro':'#64748b',
        'Interlude':'#8b5cf6','Break':'#06b6d4','Hook':'#ec4899'}};
    structure.forEach((sec, i) => {{
        const div = document.createElement('div');
        div.className = 'structure-section';
        const pct = ((sec.time_end - sec.time_start) / duration * 100);
        div.style.width = pct + '%';
        const name = sec.name || sec.label || String.fromCharCode(65 + i);
        div.style.background = nameColors[name] || colors[i % colors.length];
        div.textContent = name;
        div.addEventListener('click', () => {{
            STEMS.forEach(s => {{ audios[s].currentTime = sec.time_start; }});
            seekBar.value = (sec.time_start / duration) * 10000;
        }});
        bar.appendChild(div);
    }});
}}

function updateStructureHighlight(t) {{
    const sections = document.querySelectorAll('.structure-section');
    sections.forEach((el, i) => {{
        if (i < structure.length) {{
            const active = t >= structure[i].time_start && t < structure[i].time_end;
            el.style.opacity = active ? '1' : '0.5';
        }}
    }});
}}

// === Drum Pattern Grid ===
function drawDrumGrid() {{
    const canvas = document.getElementById('drumCanvas');
    if (!canvas || !drumPattern.kick) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const w = canvas.offsetWidth, h = canvas.offsetHeight;

    const bands = [
        {{ name: 'Kick', data: drumPattern.kick || [], color: '#e94560' }},
        {{ name: 'Snare', data: drumPattern.snare || [], color: '#f59e0b' }},
        {{ name: 'HiHat', data: drumPattern.hihat || [], color: '#10b981' }},
    ];
    const rowH = h / 3;
    bands.forEach((band, row) => {{
        ctx.fillStyle = '#303050';
        ctx.font = '9px monospace';
        ctx.fillText(band.name, 2, row * rowH + 12);
        band.data.forEach(t => {{
            const x = (t / duration) * w;
            ctx.fillStyle = band.color;
            ctx.globalAlpha = 0.7;
            ctx.fillRect(x, row * rowH + 2, 2, rowH - 4);
        }});
        ctx.globalAlpha = 1;
    }});
}}

// === Bass Line ===
function drawBassLine() {{
    const canvas = document.getElementById('bassCanvas');
    if (!canvas || bassNotes.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const w = canvas.offsetWidth, h = canvas.offsetHeight;

    const midis = bassNotes.map(n => n.midi);
    const minMidi = Math.min(...midis) - 2;
    const maxMidi = Math.max(...midis) + 2;
    const range = maxMidi - minMidi || 1;

    // Grid lines
    ctx.strokeStyle = '#1a1a3e';
    ctx.lineWidth = 0.5;
    for (let m = minMidi; m <= maxMidi; m++) {{
        const y = h - ((m - minMidi) / range) * h;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }}

    // Notes
    ctx.fillStyle = '#10b981';
    ctx.font = '8px monospace';
    for (let i = 0; i < bassNotes.length; i++) {{
        const n = bassNotes[i];
        const x = (n.time / duration) * w;
        const y = h - ((n.midi - minMidi) / range) * h;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Show note name occasionally
        if (i % Math.max(1, Math.floor(bassNotes.length / 40)) === 0) {{
            ctx.fillStyle = '#607070';
            ctx.fillText(n.note, x + 4, y - 2);
            ctx.fillStyle = '#10b981';
        }}
    }}
}}

// === Expression & Articulation View ===
const exprCanvas = document.getElementById('exprCanvas');
const exprStemSelect = document.getElementById('exprStemSelect');
const exprStatsEl = document.getElementById('exprStats');

function drawExpression() {{
    if (!exprCanvas || !resynthEvents || duration <= 0) return;
    const stem = exprStemSelect.value;
    const events = resynthEvents[stem];
    if (!events || !Array.isArray(events) || events.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    exprCanvas.width = exprCanvas.offsetWidth * dpr;
    exprCanvas.height = exprCanvas.offsetHeight * dpr;
    const ctx = exprCanvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const w = exprCanvas.offsetWidth, h = exprCanvas.offsetHeight;

    // Find pitch range (use compact field names: midi, dur, vel, art, orn, syn, vib, bend, slur)
    const midis = events.map(e => e.midi).filter(m => m != null);
    if (midis.length === 0) return;
    const minMidi = Math.min(...midis) - 2;
    const maxMidi = Math.max(...midis) + 2;
    const range = maxMidi - minMidi || 1;

    ctx.fillStyle = '#0a0a1e';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1a1a3e';
    ctx.lineWidth = 0.5;
    for (let m = minMidi; m <= maxMidi; m += 2) {{
        const y = h - ((m - minMidi) / range) * h;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }}

    const colors = {{ grace_note:'#f59e0b', trill:'#ec4899', legato:'#10b981',
        staccato:'#64748b', accent:'#ef4444', normal:'#94a3b8' }};
    let stats = {{ grace:0, trill:0, syn:0, legato:0, vib:0, bend:0, slur:0 }};
    const noteH = Math.max(3, h / range * 0.8);

    for (const e of events) {{
        const x = (e.time / duration) * w;
        const nw = Math.max(2, ((e.dur||0.05) / duration) * w);
        const y = h - ((e.midi - minMidi) / range) * h;
        let color = colors[e.art] || colors.normal;
        if (e.orn === 'grace_note') {{ color = colors.grace_note; stats.grace++; }}
        else if (e.orn === 'trill') {{ color = colors.trill; stats.trill++; }}
        if (e.syn) stats.syn++;
        if (e.art === 'legato') stats.legato++;
        if (e.vib) stats.vib++;
        if (e.bend) stats.bend++;
        if (e.slur) stats.slur++;

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.7 + (e.vel||0.5) * 0.3;
        ctx.fillRect(x, y - noteH/2, nw, noteH);
        ctx.globalAlpha = 1;

        if (e.syn) {{
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(x, y - noteH/2 - 5);
            ctx.lineTo(x-2, y - noteH/2 - 1);
            ctx.lineTo(x+2, y - noteH/2 - 1);
            ctx.fill();
        }}
        if (e.vib) {{
            ctx.strokeStyle = '#8b5cf6'; ctx.lineWidth = 1;
            ctx.beginPath();
            for (let wx = 0; wx < nw; wx += 2) {{
                const wy = Math.sin(wx * 0.8) * 2;
                if (wx === 0) ctx.moveTo(x+wx, y-noteH/2-3+wy);
                else ctx.lineTo(x+wx, y-noteH/2-3+wy);
            }}
            ctx.stroke();
        }}
        if (e.bend) {{
            ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 1.5;
            const isUp = e.bend[0] === 's' ? e.bend[1] === 'l' : e.bend[1] === 'e';
            ctx.beginPath();
            ctx.moveTo(x, y + (isUp ? 4 : -4));
            ctx.lineTo(x + 3, y);
            ctx.stroke();
        }}
        if (e.slur) {{
            ctx.strokeStyle = '#10b98155'; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y + noteH/2 + 2);
            ctx.lineTo(x + nw, y + noteH/2 + 2);
            ctx.stroke();
        }}
    }}

    // Playhead
    const ct = audios[STEMS[0]] ? audios[STEMS[0]].currentTime : 0;
    if (ct > 0) {{
        ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo((ct/duration)*w, 0); ctx.lineTo((ct/duration)*w, h); ctx.stroke();
    }}

    exprStatsEl.innerHTML = [
        stats.grace ? `Grace: ${{stats.grace}}` : '',
        stats.trill ? `Trills: ${{stats.trill}}` : '',
        stats.syn ? `Syncopated: ${{stats.syn}}` : '',
        stats.legato ? `Legato: ${{stats.legato}}` : '',
        stats.vib ? `Vibrato: ${{stats.vib}}` : '',
        stats.bend ? `Bends: ${{stats.bend}}` : '',
        stats.slur ? `Slurs: ${{stats.slur}}` : '',
    ].filter(Boolean).join(' &middot; ');
}}

if (exprStemSelect) {{
    exprStemSelect.addEventListener('change', drawExpression);
}}

// Draw on load
setTimeout(drawExpression, 500);

// Redraw expression with playhead during animation
const origAnimate = typeof animate === 'function' ? animate : null;

document.getElementById('info').textContent = STEMS.length + ' stems | Analysis powered by demucs + librosa';
if (analysis && analysis.arrangement && analysis.arrangement.summary) {{
    document.getElementById('info').textContent += ' + MiniMax';
}}

// === RESYNTHESIS ENGINE ===
const resynthEvents = {resynth_json};
const samplePaths = {sample_rels_json};
let resynthMode = false;
let sampleBuffers = {{}};  // stem -> AudioBuffer (or drum sub-samples)
let resynthTimers = [];
let timbreSwap = {{}};  // stem -> which sample to use

const resynthBtn = document.getElementById('resynthBtn');
const swapPanel = document.getElementById('swapPanel');

// Load timbre samples
function ensureAudioCtx() {{
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}}
async function loadSamples() {{
    for (const [stem, pathOrObj] of Object.entries(samplePaths)) {{
        try {{
            if (typeof pathOrObj === 'string') {{
                const resp = await fetch(pathOrObj);
                const buf = await resp.arrayBuffer();
                sampleBuffers[stem] = await ensureAudioCtx().decodeAudioData(buf);
            }} else {{
                // Drum samples: kick/snare/hihat paths
                sampleBuffers[stem] = {{}};
                for (const [hit, p] of Object.entries(pathOrObj)) {{
                    const resp = await fetch(p);
                    const buf = await resp.arrayBuffer();
                    sampleBuffers[stem][hit] = await audioCtx.decodeAudioData(buf);
                }}
            }}
        }} catch(e) {{ console.warn('Failed to load sample', stem, e); }}
    }}
}}
loadSamples();

// Initialize swap mapping (each stem uses its own timbre by default)
STEMS.forEach(s => {{ timbreSwap[s] = s; }});

// Build swap controls
function buildSwapControls() {{
    const container = document.getElementById('swapControls');
    container.innerHTML = '';
    STEMS.forEach(s => {{
        const div = document.createElement('div');
        div.className = 'swap-item';
        const label = document.createElement('span');
        label.textContent = ({{ vocals:'Vocals', drums:'Drums', bass:'Bass', other:'Other' }})[s] || s;
        label.style.color = COLORS[s];
        label.style.fontWeight = 'bold';
        label.style.minWidth = '50px';
        const arrow = document.createElement('span');
        arrow.textContent = ' uses ';
        arrow.style.color = '#505070';
        const select = document.createElement('select');
        select.dataset.stem = s;
        STEMS.forEach(t => {{
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = ({{ vocals:'Vocals timbre', drums:'Drums timbre', bass:'Bass timbre', other:'Other timbre' }})[t] || t;
            if (t === s) opt.selected = true;
            select.appendChild(opt);
        }});
        select.addEventListener('change', () => {{ timbreSwap[s] = select.value; }});
        div.appendChild(label);
        div.appendChild(arrow);
        div.appendChild(select);
        container.appendChild(div);
    }});
}}
buildSwapControls();

// Resynth toggle
resynthBtn.addEventListener('click', () => {{
    resynthMode = !resynthMode;
    resynthBtn.textContent = 'Resynth: ' + (resynthMode ? 'ON' : 'OFF');
    resynthBtn.classList.toggle('active', resynthMode);
    swapPanel.style.display = resynthMode ? 'block' : 'none';

    if (resynthMode) {{
        // Mute original stems
        STEMS.forEach(s => {{ audios[s].volume = 0; }});
    }} else {{
        // Restore volumes
        STEMS.forEach(s => {{
            const slider = document.querySelector(`.vol-slider[data-stem="${{s}}"]`);
            audios[s].volume = slider ? slider.value / 100 : 1;
        }});
        stopAllResynth();
    }}
}});

function stopAllResynth() {{
    resynthTimers.forEach(t => clearTimeout(t));
    resynthTimers = [];
}}

// Play a single sample at a given pitch
function playSample(buffer, midi, velocity, when) {{
    if (!buffer || !audioCtx) return;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const baseMidi = 60;
    source.playbackRate.value = Math.pow(2, (midi - baseMidi) / 12);
    const gain = audioCtx.createGain();
    gain.gain.value = Math.min(1, velocity * 0.8);
    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start(when);
    return source;
}}

function playDrumHit(hitType, velocity, when) {{
    if (!audioCtx) return;
    const stemTimbre = timbreSwap['drums'] || 'drums';
    const buffers = sampleBuffers[stemTimbre];
    if (!buffers) return;
    const buffer = typeof buffers === 'object' && !(buffers instanceof AudioBuffer) ? buffers[hitType] : buffers;
    if (!buffer) return;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.value = Math.min(1, velocity * 0.7);
    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start(when);
}}

// Schedule resynth playback from a given time
function scheduleResynth(startTime) {{
    stopAllResynth();
    if (!resynthMode) return;

    const now = audioCtx ? audioCtx.currentTime : 0;

    STEMS.forEach(stem => {{
        const events = resynthEvents[stem];
        if (!events) return;

        const stemTimbre = timbreSwap[stem] || stem;
        const buffer = sampleBuffers[stemTimbre];

        if (stem === 'drums') {{
            ['kick', 'snare', 'hihat'].forEach(hitType => {{
                const hits = events[hitType] || [];
                hits.forEach(hit => {{
                    if (hit.time < startTime) return;
                    const delay = hit.time - startTime;
                    if (delay > 30) return;
                    const t = setTimeout(() => {{
                        if (!resynthMode) return;
                        playDrumHit(hitType, hit.vel || hit.velocity || 0.5, 0);
                    }}, delay * 1000);
                    resynthTimers.push(t);
                }});
            }});
        }} else if (Array.isArray(events)) {{
            events.forEach(evt => {{
                if (evt.time < startTime) return;
                const delay = evt.time - startTime;
                if (delay > 30) return;
                const t = setTimeout(() => {{
                    if (!resynthMode) return;
                    if (evt.midi) {{
                        playSample(buffer, evt.midi, evt.vel || evt.velocity || 0.7, 0);
                    }} else if (evt.p || evt.pitches) {{
                        (evt.p || evt.pitches).forEach(p => {{
                            playSample(buffer, p.midi, (evt.vel || evt.velocity || 0.7) * (p.strength || 0.7), 0);
                        }});
                    }}
                }}, delay * 1000);
                resynthTimers.push(t);
            }});
        }}
    }});

    // Re-schedule for next 30s chunk
    const refreshTimer = setTimeout(() => {{
        if (resynthMode && isPlaying) {{
            const currentTime = audios[STEMS[0]].currentTime;
            scheduleResynth(currentTime);
        }}
    }}, 25000);
    resynthTimers.push(refreshTimer);
}}

// Hook into play/pause/seek
const origPlay = playBtn.onclick;
playBtn.addEventListener('click', () => {{
    if (resynthMode) {{
        setTimeout(() => {{
            if (isPlaying) {{
                const t = audios[STEMS[0]].currentTime;
                scheduleResynth(t);
            }} else {{
                stopAllResynth();
            }}
        }}, 50);
    }}
}});

seekBar.addEventListener('input', () => {{
    if (resynthMode && isPlaying) {{
        const t = (seekBar.value / 10000) * duration;
        scheduleResynth(t);
    }}
}});

bootstrapReadyMetadata();
</script>
</body>
</html>"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
