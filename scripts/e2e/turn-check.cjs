#!/usr/bin/env node
/**
 * turn-check — proves the Cloudflare TURN relay actually connects peers.
 *
 * Fetches live TURN creds from /api/turn-credentials, then connects two
 * RTCPeerConnections with iceTransportPolicy:'relay' (ALL traffic forced through
 * TURN — no host/srflx allowed). If it reaches 'connected', the relay works, which
 * is exactly the path two same-network/firewalled PCs will use.
 *
 *   cd scripts/e2e && node turn-check.cjs
 */
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const BASE = (process.env.E2E_BASE || 'https://zhaxiaoji.com').replace(/\/+$/, '');

function findChrome() {
  if (process.env.E2E_CHROME && fs.existsSync(process.env.E2E_CHROME)) return process.env.E2E_CHROME;
  return [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].find((p) => { try { return fs.existsSync(p); } catch { return false; } });
}

(async () => {
  const sfx = String(Date.now()).slice(-6);
  const reg = await (await fetch(`${BASE}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `turnc_${sfx}`, email: `turnc_${sfx}@e2e.test`, password: 'Passw0rd1' }),
  })).json();
  const r = await (await fetch(`${BASE}/api/turn-credentials`, { headers: { Authorization: `Bearer ${reg.token}` } })).json();
  if (!r.iceServers) { console.log('FAIL: endpoint returned no TURN servers:', r.reason); process.exit(1); }
  console.log('TURN urls:', r.iceServers.urls.join(', '));

  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const result = await page.evaluate(async (ice) => {
    const cfg = { iceServers: [ice], iceTransportPolicy: 'relay' };   // RELAY ONLY → must use TURN
    const a = new RTCPeerConnection(cfg), b = new RTCPeerConnection(cfg);
    a.onicecandidate = (e) => e.candidate && b.addIceCandidate(e.candidate.toJSON());
    b.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate.toJSON());
    let relayPairs = 0;
    a.onicecandidate = (e) => { if (e.candidate) { if (e.candidate.candidate.includes('relay')) relayPairs++; b.addIceCandidate(e.candidate.toJSON()); } };
    a.createDataChannel('probe');
    const offer = await a.createOffer(); await a.setLocalDescription(offer); await b.setRemoteDescription(offer);
    const answer = await b.createAnswer(); await b.setLocalDescription(answer); await a.setRemoteDescription(answer);
    return await new Promise((res) => {
      const t = setTimeout(() => res(`timeout conn=${a.connectionState} ice=${a.iceConnectionState} relayCands=${relayPairs}`), 15000);
      a.onconnectionstatechange = () => {
        if (a.connectionState === 'connected') { clearTimeout(t); res(`connected (relayCands=${relayPairs})`); }
        else if (a.connectionState === 'failed') { clearTimeout(t); res(`failed relayCands=${relayPairs}`); }
      };
    });
  }, r.iceServers);
  await browser.close();

  console.log('relay-only result:', result);
  if (result.startsWith('connected')) { console.log('\n✅ PASS — TURN relay connects peers. Same-network/firewalled PCs will work.'); process.exit(0); }
  console.log('\n❌ FAIL — relay-only connection did not establish.'); process.exit(1);
})().catch((e) => { console.error('ERROR:', e); process.exit(1); });
