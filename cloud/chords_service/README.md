# Chords Cloud Service

This service runs the full `chords` pipeline in the cloud:

- Demucs stem separation
- librosa-based analysis
- MiniMax arrangement commentary
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
- `no_minimax`
- `split_vocals`

## Environment

Required:

- `MINIMAX_API_KEY`

Recommended:

- `CHORDS_SERVICE_TOKEN`
- `CHORDS_STORAGE_DIR`
- `CHORDS_MAX_UPLOAD_MB`
- `MINIMAX_API_URL`
- `MINIMAX_MODEL`

## Docker

Build from the repo root:

```bash
docker build -f cloud/chords_service/Dockerfile -t chords-service .
docker run --rm -p 8080:8080 \
  -e MINIMAX_API_KEY=sk-... \
  -e CHORDS_SERVICE_TOKEN=replace-me \
  chords-service
```

## Cloudflare Worker Integration

The main site Worker should be configured with:

- `CHORDS_SERVICE_URL=https://your-python-service.example.com`
- secret `CHORDS_SERVICE_TOKEN`

The Worker proxies:

- `POST /api/chords/jobs`
- `GET /api/chords/jobs/:id`
- `GET /api/chords/jobs/:id/artifacts/:name`

The browser never talks to the Python service directly.
