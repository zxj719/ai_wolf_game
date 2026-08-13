# e2e regression tests

Two headless suites that drive the **real production stack**:

| 命令 | 覆盖 |
|---|---|
| `npm run verify` | WebRTC 视频通话（见下文） |
| `npm run verify:werewolf` | 游客模式狼人杀队列租约握手 |

---

## Werewolf guest-mode test (`werewolf-guest-verify.cjs`)

游客身份走完 登录页 → 游客模式 → setup → 开局，然后观察 75s（可用 `E2E_WATCH_MS`
调整），跨过 15s 轮询与 30s 心跳两道坎，断言：

- 没有被弹回 `/werewolf/setup`
- 没有出现「管理员已接管」
- 所有 `/api/werewolf/session/*` 都是 200（**401 = 缺 `X-Lease-Id`**）
- 页面日志里没有「兜底 / 决策无效 / 决策失败」

**必须以游客身份跑**：`QueueGate` 开头就是 `if (isAdmin) return children`，admin
完全绕过队列，这一整类 bug 在 admin 会话下不可复现。2026-08 连续两个线上事故
（15s 闪退、首夜全兜底）都是因为只用 admin 账号验证而漏掉的。

每次跑都用全新 `createBrowserContext()` + `setCacheEnabled(false)`，避免像手动
测试那样测到浏览器缓存里的旧 chunk。输出会打印实际加载的 `WerewolfModule-*.js`
文件名——**核对它和 `dist/assets/` 一致，再相信结果**。

注意：浏览器被强杀时不会触发 `release()`，队列锁会挂到 5 分钟后自然过期。跑完
如果别人要用，手动 release 一下。

---

## WebRTC e2e regression test

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
