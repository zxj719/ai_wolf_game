#!/usr/bin/env node
/**
 * Chords library management CLI.
 *
 * Commands:
 *   list                        — show all completed local jobs
 *   publish <job_id> [song_id]  — copy artifacts to public/chords/ and update manifest
 *   remove  <song_id>           — remove a song from manifest and delete its public dir
 *   status                      — show current manifest contents
 *   deploy                      — build + wrangler deploy
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { basename, join, resolve } from 'path';
import { execSync } from 'child_process';

const ROOT = resolve(import.meta.dirname, '..');
const STORAGE_DIR = join(ROOT, 'cloud', 'chords_service', 'storage');
const PUBLIC_CHORDS = join(ROOT, 'public', 'chords');
const MANIFEST_PATH = join(PUBLIC_CHORDS, 'manifest.json');

function readManifest() {
  if (!existsSync(MANIFEST_PATH)) return { version: 1, updated_at: new Date().toISOString(), songs: [] };
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
}

function writeManifest(manifest) {
  manifest.updated_at = new Date().toISOString();
  mkdirSync(PUBLIC_CHORDS, { recursive: true });
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

function readJobMeta(jobId) {
  const metaPath = join(STORAGE_DIR, jobId, 'job.json');
  if (!existsSync(metaPath)) return null;
  return JSON.parse(readFileSync(metaPath, 'utf-8'));
}

function listLocalJobs() {
  if (!existsSync(STORAGE_DIR)) { console.log('No local storage directory found.'); return; }
  const dirs = readdirSync(STORAGE_DIR).filter(d => d.startsWith('job_'));
  if (!dirs.length) { console.log('No local jobs found.'); return; }

  console.log(`\n  Local jobs (${STORAGE_DIR}):\n`);
  for (const dir of dirs) {
    const meta = readJobMeta(dir);
    if (!meta) { console.log(`  ${dir}  [no metadata]`); continue; }
    const status = meta.status || '?';
    const name = meta.source_filename || '?';
    const marker = status === 'completed' ? '\x1b[32m✓\x1b[0m' : status === 'failed' ? '\x1b[31m✗\x1b[0m' : '\x1b[33m○\x1b[0m';
    console.log(`  ${marker} ${dir}  ${name}  [${status}]`);
  }
  console.log();
}

function buildSongEntry(jobId, songId, meta, outputDir) {
  const artifacts = [];
  const files = readdirSync(outputDir);

  for (const file of files) {
    if (file === 'job.json' || file.endsWith('.mp3') || file.endsWith('.original')) continue;
    const filePath = join(outputDir, file);
    const stat = statSync(filePath);
    if (!stat.isFile()) continue;

    let kind = 'file';
    if (file.endsWith('.wav')) kind = 'stem';
    else if (file.endsWith('.html')) kind = 'player';
    else if (file.includes('analysis') && file.endsWith('.json')) kind = 'analysis';
    else if (file.includes('resynth') && file.endsWith('.json')) kind = 'resynth';

    const contentType = file.endsWith('.wav') ? 'audio/wav'
      : file.endsWith('.html') ? 'text/html'
      : file.endsWith('.json') ? 'application/json'
      : 'application/octet-stream';

    artifacts.push({ name: file, path: file, kind, size_bytes: stat.size, content_type: contentType });
  }

  let analysis = null;
  const analysisArtifact = meta.analysis_artifact || artifacts.find(a => a.kind === 'analysis')?.path;
  if (analysisArtifact) {
    const analysisPath = join(outputDir, analysisArtifact);
    if (existsSync(analysisPath)) {
      try { analysis = JSON.parse(readFileSync(analysisPath, 'utf-8')); } catch {}
    }
  }

  return {
    id: songId,
    status: 'completed',
    title: meta.source_filename || basename(outputDir),
    source_filename: meta.source_filename || '',
    source_size_bytes: meta.source_size_bytes || 0,
    created_at: meta.created_at || new Date().toISOString(),
    completed_at: meta.completed_at || new Date().toISOString(),
    player_artifact: meta.player_artifact || null,
    analysis_artifact: analysisArtifact || null,
    resynth_artifact: meta.resynth_artifact || null,
    analysis,
    artifacts,
  };
}

function findOutputDir(jobDir) {
  const outputSub = join(jobDir, 'output');
  if (existsSync(outputSub)) return outputSub;
  return jobDir;
}

function convertWavsToMp3(targetDir) {
  const wavFiles = readdirSync(targetDir).filter(f => f.endsWith('.wav'));
  if (!wavFiles.length) return 0;

  const wav2mp3 = join(ROOT, 'scripts', 'wav2mp3.py');
  let converted = 0;
  for (const wav of wavFiles) {
    const wavPath = join(targetDir, wav);
    const mp3Path = join(targetDir, wav.replace(/\.wav$/, '.mp3'));
    try {
      execSync(`python "${wav2mp3}" "${wavPath}" "${mp3Path}"`, { stdio: 'pipe', timeout: 120_000 });
      rmSync(wavPath);
      converted++;
    } catch (e) {
      console.warn(`    Warning: failed to convert ${wav}: ${e.message}`);
    }
  }

  const htmlFiles = readdirSync(targetDir).filter(f => f.endsWith('.html'));
  for (const html of htmlFiles) {
    const htmlPath = join(targetDir, html);
    let content = readFileSync(htmlPath, 'utf-8');
    content = content.replace(/\.wav/g, '.mp3');
    writeFileSync(htmlPath, content, 'utf-8');
  }

  return converted;
}

function publish(jobId, songId) {
  const jobDir = join(STORAGE_DIR, jobId);
  if (!existsSync(jobDir)) { console.error(`Job directory not found: ${jobDir}`); process.exit(1); }

  const meta = readJobMeta(jobId);
  if (!meta) { console.error(`No job.json found in ${jobDir}`); process.exit(1); }
  if (meta.status !== 'completed') { console.error(`Job ${jobId} is not completed (status: ${meta.status})`); process.exit(1); }

  if (!songId) {
    const stem = (meta.source_filename || jobId).replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    songId = stem;
  }

  const outputDir = findOutputDir(jobDir);
  const targetDir = join(PUBLIC_CHORDS, songId);
  mkdirSync(targetDir, { recursive: true });

  const files = readdirSync(outputDir).filter(f => f !== 'job.json');
  for (const file of files) {
    const src = join(outputDir, file);
    if (!statSync(src).isFile()) continue;
    cpSync(src, join(targetDir, file));
  }

  console.log(`    Converting WAV stems to MP3 for cloud deployment...`);
  const converted = convertWavsToMp3(targetDir);
  if (converted) console.log(`    ${converted} WAV file(s) converted to MP3`);

  const songEntry = buildSongEntry(jobId, songId, meta, targetDir);

  const manifest = readManifest();
  const idx = manifest.songs.findIndex(s => s.id === songId);
  if (idx >= 0) manifest.songs[idx] = songEntry;
  else manifest.songs.push(songEntry);
  writeManifest(manifest);

  console.log(`\n  \x1b[32m✓\x1b[0m Published "${meta.source_filename}" as "${songId}"`);
  console.log(`    ${files.length} files published to public/chords/${songId}/`);
  console.log(`    Manifest updated (${manifest.songs.length} song(s))\n`);
}

function remove(songId) {
  const manifest = readManifest();
  const idx = manifest.songs.findIndex(s => s.id === songId);
  if (idx < 0) { console.error(`Song "${songId}" not found in manifest.`); process.exit(1); }

  manifest.songs.splice(idx, 1);
  writeManifest(manifest);

  const targetDir = join(PUBLIC_CHORDS, songId);
  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true });
    console.log(`\n  \x1b[31m✗\x1b[0m Removed "${songId}" from manifest and deleted public/chords/${songId}/\n`);
  } else {
    console.log(`\n  \x1b[31m✗\x1b[0m Removed "${songId}" from manifest (directory already gone)\n`);
  }
}

function status() {
  const manifest = readManifest();
  console.log(`\n  Manifest: ${manifest.songs.length} song(s)  (updated ${manifest.updated_at})\n`);
  for (const song of manifest.songs) {
    const arts = (song.artifacts || []).length;
    console.log(`  \x1b[36m●\x1b[0m ${song.id}  "${song.source_filename}"  [${arts} artifacts]`);
  }
  if (!manifest.songs.length) console.log('  (empty)');
  console.log();
}

function deploy() {
  console.log('\n  Building and deploying...\n');
  try {
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
    execSync('npm run deploy', { cwd: ROOT, stdio: 'inherit' });
    console.log('\n  \x1b[32m✓\x1b[0m Deployed to production.\n');
  } catch (e) {
    console.error('\n  \x1b[31m✗\x1b[0m Deploy failed.\n');
    process.exit(1);
  }
}

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case 'list': listLocalJobs(); break;
  case 'publish': publish(args[0], args[1]); break;
  case 'remove': remove(args[0]); break;
  case 'status': status(); break;
  case 'deploy': deploy(); break;
  default:
    console.log(`
  Usage: node scripts/chords-manage.mjs <command>

  Commands:
    list                        Show all local jobs
    publish <job_id> [song_id]  Publish a completed job to public/chords/
    remove  <song_id>           Remove a song from the library
    status                      Show manifest contents
    deploy                      Build + deploy to Cloudflare
`);
}
