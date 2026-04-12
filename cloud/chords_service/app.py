from __future__ import annotations

import json
import mimetypes
import os
import re
import shutil
import threading
import traceback
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from pipeline.analyze import run_full_analysis
from pipeline.minimax_music import (
    analyze_arrangement_with_minimax,
    build_track_summary,
)
from pipeline.resynth import transcribe_all_stems
from pipeline.separator import separate
from pipeline.stem_player import generate_stem_player
from pipeline.vocal_harmony import separate_harmonies

APP_DIR = Path(__file__).resolve().parent
STORAGE_DIR = Path(os.getenv("CHORDS_STORAGE_DIR", APP_DIR / "storage")).resolve()
MAX_UPLOAD_MB = int(os.getenv("CHORDS_MAX_UPLOAD_MB", "25"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
AUTH_TOKEN = os.getenv("CHORDS_SERVICE_TOKEN", "").strip()
JOB_LOCK = threading.Lock()

app = FastAPI(title="Chords Cloud Service", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def sanitize_filename(filename: str) -> str:
    base = Path(filename or "track.mp3").name
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._")
    return safe or "track.mp3"


def infer_artifact_kind(path: Path) -> str:
    name = path.name
    suffix = path.suffix.lower()
    if suffix == ".html":
        return "player"
    if name.endswith("_analysis.json"):
        return "analysis"
    if name.endswith("_resynth.json"):
        return "resynth"
    if suffix == ".wav":
        return "stem"
    return "file"


def make_artifact_entry(path: Path) -> dict:
    return {
        "name": path.name,
        "path": path.name,
        "kind": infer_artifact_kind(path),
        "size_bytes": path.stat().st_size,
        "content_type": mimetypes.guess_type(path.name)[0] or "application/octet-stream",
    }


def job_dir(job_id: str) -> Path:
    return STORAGE_DIR / job_id


def job_meta_path(job_id: str) -> Path:
    return job_dir(job_id) / "job.json"


def read_job_meta(job_id: str) -> dict:
    path = job_meta_path(job_id)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Job not found")
    return json.loads(path.read_text(encoding="utf-8"))


def write_job_meta(job_id: str, payload: dict) -> dict:
    path = job_meta_path(job_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(".tmp")
    temp_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    temp_path.replace(path)
    return payload


def update_job(job_id: str, **updates) -> dict:
    with JOB_LOCK:
        payload = read_job_meta(job_id)
        payload.update(updates)
        payload["updated_at"] = utcnow_iso()
        return write_job_meta(job_id, payload)


def collect_artifacts(output_dir: Path) -> list[dict]:
    if not output_dir.is_dir():
        return []
    return [
        make_artifact_entry(path)
        for path in sorted(output_dir.iterdir())
        if path.is_file()
    ]


def build_public_job(payload: dict) -> dict:
    public_job = {
        key: value
        for key, value in payload.items()
        if key not in {"input_path", "output_dir", "traceback"}
    }

    output_dir = Path(payload["output_dir"])
    artifacts = collect_artifacts(output_dir)
    public_job["artifacts"] = artifacts

    if artifacts:
        public_job.setdefault(
            "player_artifact",
            next((item["path"] for item in artifacts if item["kind"] == "player"), None),
        )
        public_job.setdefault(
            "analysis_artifact",
            next((item["path"] for item in artifacts if item["kind"] == "analysis"), None),
        )
        public_job.setdefault(
            "resynth_artifact",
            next((item["path"] for item in artifacts if item["kind"] == "resynth"), None),
        )

    analysis_artifact = public_job.get("analysis_artifact")
    if analysis_artifact:
        analysis_path = output_dir / analysis_artifact
        if analysis_path.is_file():
            try:
                public_job["analysis"] = json.loads(analysis_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                pass

    return public_job


def require_auth(authorization: str | None = Header(default=None)) -> None:
    if not AUTH_TOKEN:
        return
    if authorization != f"Bearer {AUTH_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def write_analysis_json(output_dir: Path, base_name: str, analysis: dict) -> str:
    analysis_path = output_dir / f"{base_name}_analysis.json"
    analysis_path.write_text(
        json.dumps(analysis, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return analysis_path.name


def write_resynth_summary(output_dir: Path, base_name: str, resynth_data: dict | None) -> str | None:
    if not resynth_data:
        return None

    summary = {}
    for stem_name, payload in resynth_data.items():
        events = payload.get("events", [])
        if isinstance(events, dict):
          event_count = sum(len(items) for items in events.values())
        else:
          event_count = len(events)
        summary[stem_name] = {
            "event_count": event_count,
            "samples": payload.get("samples"),
        }

    summary_path = output_dir / f"{base_name}_resynth.json"
    summary_path.write_text(
        json.dumps(summary, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return summary_path.name


def run_pipeline_job(job_id: str) -> None:
    payload = read_job_meta(job_id)
    input_path = Path(payload["input_path"])
    output_dir = Path(payload["output_dir"])
    options = payload.get("options", {})

    try:
        update_job(job_id, status="processing", step="Separating stems", progress=0.1, error=None)
        model_name = "htdemucs" if options.get("four_stems") else "htdemucs_6s"
        stem_paths = separate(str(input_path), str(output_dir), model_name=model_name)

        update_job(job_id, step="Analyzing track", progress=0.4)
        analysis = run_full_analysis(str(input_path), stem_paths)

        if not options.get("no_minimax"):
            update_job(job_id, step="Generating MiniMax arrangement notes", progress=0.58)
            track_summary = build_track_summary(analysis, list(stem_paths.keys()))
            analysis["arrangement"] = analyze_arrangement_with_minimax(track_summary)

        analysis_artifact = write_analysis_json(output_dir, input_path.stem, analysis)

        resynth_data = None
        resynth_artifact = None
        if not options.get("no_resynth"):
            update_job(job_id, step="Transcribing stems", progress=0.72)
            resynth_data = transcribe_all_stems(stem_paths, str(output_dir))
            resynth_artifact = write_resynth_summary(output_dir, input_path.stem, resynth_data)

        split_vocals = int(options.get("split_vocals") or 0)
        if split_vocals > 1 and "vocals" in stem_paths:
            update_job(job_id, step="Splitting vocal harmonies", progress=0.84)
            harmony_data = separate_harmonies(
                stem_paths["vocals"],
                str(output_dir),
                max_voices=split_vocals,
            )
            if harmony_data and harmony_data.get("n_voices", 0) > 0:
                for voice in harmony_data.get("voices", []):
                    voice_key = f"vocal_{voice['name'].lower()}"
                    stem_paths[voice_key] = voice["path"]

        update_job(job_id, step="Generating stem player", progress=0.92)
        html_name = f"{input_path.stem}_stems.html"
        html_path = output_dir / html_name
        generate_stem_player(stem_paths, str(input_path), str(html_path), analysis, resynth_data)

        update_job(
            job_id,
            status="completed",
            step="Completed",
            progress=1.0,
            completed_at=utcnow_iso(),
            player_artifact=html_name,
            analysis_artifact=analysis_artifact,
            resynth_artifact=resynth_artifact,
        )
    except Exception as exc:
        update_job(
            job_id,
            status="failed",
            step="Failed",
            progress=1.0,
            completed_at=utcnow_iso(),
            error=str(exc),
            traceback=traceback.format_exc(),
        )


@app.get("/health")
def healthcheck() -> dict:
    return {
        "status": "ok",
        "timestamp": utcnow_iso(),
        "storage_dir": str(STORAGE_DIR),
    }


@app.post("/jobs", dependencies=[Depends(require_auth)])
async def create_job(
    file: UploadFile = File(...),
    four_stems: bool = Form(False),
    no_resynth: bool = Form(False),
    no_minimax: bool = Form(False),
    split_vocals: int = Form(0),
) -> dict:
    source_filename = sanitize_filename(file.filename or "track.mp3")
    suffix = Path(source_filename).suffix.lower()
    if suffix not in {".mp3", ".wav", ".m4a"}:
        raise HTTPException(status_code=400, detail="Only MP3, WAV, and M4A files are supported.")

    job_id = f"job_{uuid4().hex[:12]}"
    current_job_dir = job_dir(job_id)
    input_dir = current_job_dir / "input"
    output_dir = current_job_dir / "output"
    input_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    input_path = input_dir / source_filename
    total_size = 0

    try:
        with input_path.open("wb") as handle:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Upload exceeds {MAX_UPLOAD_MB} MB limit.",
                    )
                handle.write(chunk)
    except Exception:
        shutil.rmtree(current_job_dir, ignore_errors=True)
        raise
    finally:
        await file.close()

    payload = {
        "id": job_id,
        "status": "queued",
        "step": "Queued",
        "progress": 0.0,
        "created_at": utcnow_iso(),
        "updated_at": utcnow_iso(),
        "completed_at": None,
        "source_filename": source_filename,
        "source_size_bytes": total_size,
        "error": None,
        "input_path": str(input_path),
        "output_dir": str(output_dir),
        "options": {
            "four_stems": bool(four_stems),
            "no_resynth": bool(no_resynth),
            "no_minimax": bool(no_minimax),
            "split_vocals": int(split_vocals),
        },
    }
    write_job_meta(job_id, payload)

    thread = threading.Thread(target=run_pipeline_job, args=(job_id,), daemon=True)
    thread.start()

    return {"success": True, "job": build_public_job(payload)}


@app.get("/jobs/{job_id}", dependencies=[Depends(require_auth)])
def get_job(job_id: str) -> dict:
    return {"success": True, "job": build_public_job(read_job_meta(job_id))}


@app.get("/jobs/{job_id}/artifacts/{artifact_path:path}", dependencies=[Depends(require_auth)])
def get_artifact(job_id: str, artifact_path: str):
    payload = read_job_meta(job_id)
    output_dir = Path(payload["output_dir"]).resolve()
    requested_path = (output_dir / artifact_path).resolve()

    if not requested_path.is_file() or output_dir not in requested_path.parents:
        raise HTTPException(status_code=404, detail="Artifact not found")

    return FileResponse(
        requested_path,
        media_type=mimetypes.guess_type(requested_path.name)[0] or "application/octet-stream",
        filename=requested_path.name,
    )


@app.on_event("startup")
def prepare_storage() -> None:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
