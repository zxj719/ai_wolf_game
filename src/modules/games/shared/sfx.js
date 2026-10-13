/**
 * sfx.js — 用 Web Audio 现场合成的短音效（不下载任何音频文件）。
 * AudioContext 在第一次用户手势后才允许发声；静音开关存 localStorage。
 */

const KEY = 'zx_games_sfx_muted';
let ctx = null;
let muted = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })();

export function isMuted() { return muted; }
export function setMuted(v) {
  muted = !!v;
  try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* ignore */ }
}

function ac() {
  if (muted || typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx.state === 'running' ? ctx : null;
}

function tone(c, { freq, to, type = 'sine', dur = 0.15, gain = 0.25, at = 0 }) {
  const t0 = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(c, { dur = 0.18, gain = 0.35, cutoff = 1800, at = 0 }) {
  const t0 = c.currentTime + at;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
}

/** 吃子：低频重击 + 碎裂噪声；power 0..1 越大越重 */
export function sfxHit(power = 0.5) {
  const c = ac();
  if (!c) return;
  tone(c, { freq: 160 + power * 60, to: 45, type: 'sine', dur: 0.22 + power * 0.15, gain: 0.45 });
  noise(c, { dur: 0.16 + power * 0.12, gain: 0.25 + power * 0.2, cutoff: 1400 + power * 2200 });
}

/** 连杀 / 斩将：上行三连音 */
export function sfxFanfare(steps = 3) {
  const c = ac();
  if (!c) return;
  const notes = [523, 659, 784, 1047, 1319];
  for (let k = 0; k < Math.min(steps, notes.length); k++) {
    tone(c, { freq: notes[k], type: 'triangle', dur: 0.14, gain: 0.16, at: 0.09 * k });
  }
}

/** 翻子：短促的「嗒」 */
export function sfxFlip() {
  const c = ac();
  if (!c) return;
  tone(c, { freq: 900, to: 500, type: 'triangle', dur: 0.07, gain: 0.12 });
}

/** 被吃 / 误伤：下行闷音 */
export function sfxOuch() {
  const c = ac();
  if (!c) return;
  tone(c, { freq: 320, to: 120, type: 'sawtooth', dur: 0.25, gain: 0.08 });
}
