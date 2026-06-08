# WebRTC e2e regression test

Headless two-browser test for the chat **video call**. It drives the **real production
stack** — CF Worker auth, ECS WebSocket signaling, browser-to-browser P2P media — with
two isolated Chrome contexts and a **fake camera**, then asserts that **remote video
flows both ways**.

This catches the bug class that unit tests cannot: WebRTC transceiver direction
(`sendrecv` vs `recvonly`) and remote-track→`<video>` binding. It's the test that would
have caught both 2026-06 black-remote bugs immediately. See
`memory/feedback_webrtc_gotchas.md`.

## Run

```bash
cd scripts/e2e
npm install          # once — puppeteer-core only (~5 MB, no browser download)
npm run verify       # or: node webrtc-verify.cjs
```

Uses your installed **Chrome** (or Edge) — no browser is downloaded. Exit code `0` =
remote video verified both directions; non-zero = failure with the reason logged.

## How it works

1. Registers/logs in two throwaway accounts (`e2ev_a_*`, `e2ev_b_*`) via the REST API and
   friends them (no UI).
2. Launches Chrome with `--use-fake-device-for-media-stream` (synthetic camera) +
   `--use-fake-ui-for-media-stream` (auto-grants permission).
3. Two `browser.createBrowserContext()` contexts; injects each account's JWT into
   `localStorage` (skips the login UI), opens `/`, clicks **好友** to reach `/chat`.
4. A calls B (`视频通话`), B accepts (`接听`).
5. Polls both pages: each must have **2 `<video>` with `videoWidth > 0`** (own + remote).

## Config (env vars)

| var | default | meaning |
|---|---|---|
| `E2E_BASE` | `https://zhaxiaoji.com` | target origin |
| `E2E_CHROME` | auto-detect | path to chrome/edge exe |
| `E2E_HEADLESS` | headless | set `0` to watch it run |
| `E2E_PASSWORD` | `Passw0rd1` | test-account password |

## Failure messages

- **`"not allowed"`** → the ECS `chatHub` is stale (still admin-gating `call:offer`).
  `git pull && pm2 restart ecosystem.config.cjs --update-env` on the ECS box.
- **callee never saw the ring** → WS signaling not relayed; check the ECS WS server / tunnel.
- **remote video did not flow** → a WebRTC regression (transceiver direction / track mapping);
  inspect `RTCPeerConnection.getTransceivers()` `currentDirection` and `receiver.track`.

## Debugging tip

Vite **strips `console.*`** from the prod bundle, so in-page `console.log` is invisible.
For ad-hoc debugging, push to a `window.__x` array in the app code and read it back with
`page.evaluate(() => window.__x)`. To inspect the live `RTCPeerConnection`, monkey-patch it
in `page.evaluateOnNewDocument` to collect instances into `window.__pcs`.
