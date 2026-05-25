# Chords Local Service

This service runs the full `chords` pipeline locally:

- Demucs stem separation
- librosa-based analysis
- Claude Code CLI arrangement commentary
- optional resynth data
- generated `*_stems.html` player plus WAV artifacts

## Endpoints

- `GET /health`
- `POST /jobs`
- `GET /jobs/{job_id}`
- `GET /jobs/{job_id}/artifacts/{artifact_path}`

`POST /jobs` accepts `multipart/form-data` with:

- `file`
- `four_stems`
- `no_resynth`
- `no_arrangement`
- `split_vocals`

## Prerequisites

- Python 3.10+
- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)

## Environment

Recommended:

- `CHORDS_SERVICE_TOKEN`
- `CHORDS_STORAGE_DIR`
- `CHORDS_MAX_UPLOAD_MB`

## Quick Start

```bash
cd cloud/chords_service
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8080
```

Then run the frontend in dev mode (`npm run dev`) and log in as admin to see the upload UI.

## How It Works

1. **Demucs** separates audio into stems (vocals, drums, bass, other, optionally piano + guitar)
2. **librosa** analyzes BPM, key, structure, per-stem stats, drum patterns, bass notes
3. **Claude Code CLI** (`claude -p`) interprets the librosa data into human-readable arrangement commentary
4. Results are saved locally in `storage/<job_id>/`

To publish analyzed songs to the cloud, copy artifacts to `public/chords/<song-id>/`, update `public/chords/manifest.json`, and deploy.
