import { normalizeArrangementResponse } from './chordsAnalysis.js';

const MANIFEST_URL = '/chords/manifest.json';
const LOCAL_SERVICE_URL = import.meta.env.DEV ? 'http://localhost:8080' : '';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildStaticArtifactUrl(songId, artifactPath) {
  if (!songId || !artifactPath) return '';
  return `/chords/${encodeURIComponent(songId)}/${artifactPath}`;
}

function buildLocalArtifactUrl(jobId, artifactPath) {
  if (!jobId || !artifactPath) return '';
  return `${LOCAL_SERVICE_URL}/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(artifactPath)}`;
}

export function normalizeSong(source) {
  const songId = String(source?.id || '');
  const analysis = source?.analysis && typeof source.analysis === 'object' ? source.analysis : null;
  const isLocal = import.meta.env.DEV && source?._local;
  const artifactUrl = isLocal ? buildLocalArtifactUrl : buildStaticArtifactUrl;

  return {
    id: songId,
    status: String(source?.status || 'completed'),
    step: String(source?.step || ''),
    progress: toNumber(source?.progress, 1),
    error: String(source?.error || ''),
    sourceFilename: String(source?.title || source?.source_filename || ''),
    sourceSizeBytes: toNumber(source?.source_size_bytes, 0),
    createdAt: String(source?.created_at || ''),
    completedAt: String(source?.completed_at || source?.created_at || ''),
    options: {},
    playerArtifact: String(source?.player_artifact || ''),
    analysisArtifact: String(source?.analysis_artifact || ''),
    resynthArtifact: String(source?.resynth_artifact || ''),
    playerUrl: artifactUrl(songId, source?.player_artifact),
    analysisUrl: artifactUrl(songId, source?.analysis_artifact),
    resynthUrl: artifactUrl(songId, source?.resynth_artifact),
    analysis,
    arrangement: normalizeArrangementResponse(analysis?.arrangement || {}),
    artifacts: Array.isArray(source?.artifacts)
      ? source.artifacts.map((a) => ({
          name: String(a?.name || ''),
          path: String(a?.path || ''),
          kind: String(a?.kind || 'file'),
          sizeBytes: toNumber(a?.size_bytes, 0),
          contentType: String(a?.content_type || ''),
          url: artifactUrl(songId, a?.path),
        }))
      : [],
  };
}

function normalizeLocalJob(payload) {
  const source = payload?.job && typeof payload.job === 'object' ? payload.job : payload;
  return normalizeSong({ ...source, _local: true });
}

let manifestCache = null;

export async function listChordsJobs() {
  if (manifestCache) return manifestCache;

  const response = await fetch(`${MANIFEST_URL}?t=${Date.now()}`);
  if (!response.ok) return [];

  const payload = await response.json().catch(() => ({ songs: [] }));
  const songs = Array.isArray(payload.songs) ? payload.songs : [];
  manifestCache = songs.map(normalizeSong);
  return manifestCache;
}

export function invalidateManifestCache() {
  manifestCache = null;
}

export async function createChordsJob(file, options = {}) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('four_stems', String(Boolean(options.fourStems)));
  formData.append('no_resynth', String(Boolean(options.noResynth)));
  formData.append('no_arrangement', String(Boolean(options.noArrangement)));
  formData.append('split_vocals', String(Number(options.splitVocals || 0)));
  if (options.songInfo) formData.append('song_info', options.songInfo);

  const response = await fetch(`${LOCAL_SERVICE_URL}/jobs`, {
    method: 'POST',
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || payload.detail || `Failed to create job: ${response.status}`);
  }
  return normalizeLocalJob(payload);
}

export async function deletePublishedSong(songId) {
  const response = await fetch(`${LOCAL_SERVICE_URL}/published/${encodeURIComponent(songId)}`, {
    method: 'DELETE',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || payload.detail || `Failed to delete: ${response.status}`);
  }
  invalidateManifestCache();
  return payload;
}

export async function getChordsJob(jobId) {
  const response = await fetch(`${LOCAL_SERVICE_URL}/jobs/${encodeURIComponent(jobId)}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || payload.detail || `Failed to fetch job: ${response.status}`);
  }
  return normalizeLocalJob(payload);
}
