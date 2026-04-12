import { buildApiUrl } from './apiBase.js';
import { normalizeArrangementResponse } from './chordsAnalysis.js';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildArtifactUrl(jobId, artifactPath) {
  if (!jobId || !artifactPath) {
    return '';
  }
  return buildApiUrl(`/api/chords/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(artifactPath)}`);
}

export function normalizeChordsJob(payload) {
  const source = payload?.job && typeof payload.job === 'object' ? payload.job : payload;
  const jobId = String(source?.id || '');
  const analysis = source?.analysis && typeof source.analysis === 'object' ? source.analysis : null;

  return {
    id: jobId,
    status: String(source?.status || 'queued'),
    step: String(source?.step || ''),
    progress: toNumber(source?.progress, 0),
    error: String(source?.error || ''),
    sourceFilename: String(source?.source_filename || ''),
    sourceSizeBytes: toNumber(source?.source_size_bytes, 0),
    createdAt: String(source?.created_at || ''),
    completedAt: String(source?.completed_at || ''),
    options: source?.options && typeof source.options === 'object' ? source.options : {},
    playerArtifact: String(source?.player_artifact || ''),
    analysisArtifact: String(source?.analysis_artifact || ''),
    resynthArtifact: String(source?.resynth_artifact || ''),
    playerUrl: buildArtifactUrl(jobId, source?.player_artifact),
    analysisUrl: buildArtifactUrl(jobId, source?.analysis_artifact),
    resynthUrl: buildArtifactUrl(jobId, source?.resynth_artifact),
    analysis,
    arrangement: normalizeArrangementResponse(analysis?.arrangement || {}),
    artifacts: Array.isArray(source?.artifacts)
      ? source.artifacts.map((artifact) => ({
          name: String(artifact?.name || ''),
          path: String(artifact?.path || ''),
          kind: String(artifact?.kind || 'file'),
          sizeBytes: toNumber(artifact?.size_bytes, 0),
          contentType: String(artifact?.content_type || ''),
          url: buildArtifactUrl(jobId, artifact?.path),
        }))
      : [],
  };
}

async function readJsonResponse(response) {
  return response.json().catch(() => ({}));
}

export async function createChordsJob(file, options = {}) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('four_stems', String(Boolean(options.fourStems)));
  formData.append('no_resynth', String(Boolean(options.noResynth)));
  formData.append('no_minimax', String(Boolean(options.noMinimax)));
  formData.append('split_vocals', String(Number(options.splitVocals || 0)));

  const response = await fetch(buildApiUrl('/api/chords/jobs'), {
    method: 'POST',
    body: formData,
  });

  const payload = await readJsonResponse(response);
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || payload.detail || `Failed to create job: ${response.status}`);
  }

  return normalizeChordsJob(payload);
}

export async function getChordsJob(jobId) {
  const response = await fetch(buildApiUrl(`/api/chords/jobs/${encodeURIComponent(jobId)}`), {
    method: 'GET',
  });

  const payload = await readJsonResponse(response);
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || payload.detail || `Failed to fetch job: ${response.status}`);
  }

  return normalizeChordsJob(payload);
}
