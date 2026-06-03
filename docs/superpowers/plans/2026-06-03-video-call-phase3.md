# 视频通话 Phase 3 实现计划（WebRTC，仅管理员发起）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans / subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 好友之间的 1 对 1 WebRTC 视频通话；**管理员发起、好友可接**；信令复用 Phase 2 的 WS 通道；媒体 P2P 直连（公共 STUN，无 TURN）。

**Architecture:** 纯前端 WebRTC（原生浏览器 API，无新依赖）+ ECS chatHub 中继 `call:*` 信令。后端**无 D1、无 Worker 改动**（通话不持久化；`conn.isAdmin` 已由 Phase 2 的 `/api/me` 委托鉴权写好）。媒体不过服务器。

**关键既有事实：**
- chatHub `handleMessage` 目前忽略 `call:*`（有注释占位）；`conn.isAdmin` 已存在（chatSocket 从 `/api/me` 取）。
- useChatSocket 当前只发 `chat:message`/`chat:typing`；需加一个通用 `sendSignal(obj)`。
- 前端 `useAuth()` 暴露 `isAdmin`；ChatRoute 已有 `chat`(useChatSocket)、`friends`、`user`。
- 测试：chatHub/reducer 可单测；VideoCallPanel 用 `renderToStaticMarkup`；**useWebRTC 依赖 RTCPeerConnection/getUserMedia，jsdom 无法跑 → 手动验证**（把可测逻辑抽成纯 reducer）。
- WebRTC 需 HTTPS（✓ 生产）+ WSS 信令（✓ Phase 2 已通）。

**决策（已确认）：** 管理员发起（`call:offer` 服务端校验 isAdmin），好友可接（answer/ice/hangup 双向放行）；P2P + 公共 STUN，无 TURN。**非对称发起天然消除 glare（offer 碰撞）。**

---

## ⚠️ 对抗评审修订（实现以本节为准，覆盖下方 Task 3/4 草案）

> 4 代理评审结论：**REQUEST CHANGES**（5 must-fix + 6 should-fix）。多 must-fix 是耦合的，一套"ref 化"改法一并解决。下方 Task 3/4 代码草案有连接级 bug，**以本节修订为准实现**。

**Must-fix（全部并入）：**
1. **CONNECTED 对任意活跃阶段生效**：`connectionState==='connected'` 是一次性边沿，可能早于 ANSWERED 落地 → 旧守卫 `phase!=='connecting'` 会丢掉它 → 永远卡"连接中"。reducer 改：`case 'CONNECTED': if (phase==='idle'||phase==='connected'||phase==='error') return state; return {...state, phase:'connected'}`。
2. **信令只订阅一次 + phaseRef + 串行队列**：subscribe 副作用 deps 仅 `[chat]`（不依赖 state.phase，杜绝重订阅丢帧）；用 `phaseRef`(单独 effect 同步)读实时阶段；忙线判定读**实时 ref**(`pcRef.current||peerRef.current`)；handler 用 promise 队列串行化(`taskRef.current = taskRef.current.then(()=>handle(msg))`)，因 emit() 不 await。
3. **ICE drain 原子化**：`drainIce` 改 `while(pendingIce.length){const c=pendingIce.shift(); try{await pc.addIceCandidate(c)}catch{}}`（旧版 for 后清空会丢掉 await 期间到达的候选）。ICE handler 统一走"push 再 drain"单路径。
4. **每个 await 后校验 pc 身份**：startCall/accept/call:answer 里 `const pc=...`，每次 await 后 `if (pcRef.current!==pc) return`（静默退出，不重发 hangup/不 ERROR）；`getMedia` 后还要查 peerRef/phaseRef 是否已取消；call:answer 的 catch 改为 ERROR+hangup+cleanup（不再吞错）。
5. **iceconnectionstatechange 兜底 + 振铃超时**：加 `pc.oniceconnectionstatechange`（connected/completed→CONNECTED，failed→ERROR）；进入 'calling' 起 45s 定时器，超时 sendSignal hangup + ERROR 'no answer'；CONNECTED/reset/cleanup 清除。

**Should-fix（并入）：**
- chatHub `call:*` 加令牌桶限流（capacity 50/refill 25）放在 isFriendOf 之前；call:* 用**不重取**的好友判定（避免 ICE flood 放大成 Worker fetch）。
- ICE 候选显式序列化：`candidate: e.candidate.toJSON ? e.candidate.toJSON() : {candidate,sdpMid,sdpMLineIndex,usernameFragment}`。
- `ontrack` 防空：`if (e.streams && e.streams[0]) setRemoteStream(e.streams[0])`。
- **ERROR 单独 'error' 阶段**（不要 reset 成 idle，否则 panel 在 idle 返回 null，相机被拒等错误永不显示）；VideoCallPanel 'error' 渲染消息 + 关闭按钮（DISMISS→idle）；ERROR 同时 cleanup 媒体。
- 忙线第二来电：读实时 ref 判忙，回 `call:hangup{reason:'busy'}`，不动 peerRef。

**reducer 最终状态/动作：** phase ∈ {idle,calling,ringing,connecting,connected,error}；action ∈ {START_CALL,INCOMING_OFFER,ACCEPT,ANSWERED,CONNECTED,HANGUP,REMOTE_HANGUP,REJECT,ERROR,DISMISS}。

---

---

## 信令协议（WS over chatHub）

| type | 方向 | payload | 服务端处理 |
|---|---|---|---|
| `call:offer` | 主叫(admin)→被叫 | `{to, sdp}` | **仅 isAdmin 放行**；非好友拒；转发，附 `from` |
| `call:answer` | 被叫→主叫 | `{to, sdp}` | 好友校验；转发，附 `from` |
| `call:ice` | 双向 | `{to, candidate}` | 好友校验；转发，附 `from` |
| `call:hangup` | 双向 | `{to}` | 转发，附 `from`（含拒接/挂断/结束） |

被叫端收到 `call:offer` 即"来电"。所有 `call:*` 走与聊天相同的好友校验（`isFriendOf`），`call:offer` 额外要 `conn.isAdmin`。

---

## File Structure

| 文件 | 操作 | 职责 |
|---|---|---|
| `server/chatHub.js` | 修改 | handleMessage 加 `call:*` 中继（offer 校验 isAdmin） |
| `server/__tests__/chatHub.test.js` | 修改 | 加 call:* 中继 + admin 门控用例 |
| `src/hooks/useChatSocket.js` | 修改 | 加通用 `sendSignal(obj)` |
| `src/modules/chat/webrtcReducer.js` | 新建 | 纯通话状态机（可测） |
| `src/modules/chat/__tests__/webrtcReducer.test.js` | 新建 | reducer 单测 |
| `src/hooks/useWebRTC.js` | 新建 | RTCPeerConnection + getUserMedia + 信令接线（用 reducer） |
| `src/modules/chat/components/VideoCallPanel.jsx` | 新建 | 来电/通话中 UI（本地+远端 video、接听/拒绝/挂断/静音/关摄像头） |
| `src/modules/chat/__tests__/videoCallPanel.test.jsx` | 新建 | VideoCallPanel 冒烟测试 |
| `src/modules/chat/ChatRoute.jsx` | 修改 | 挂 useWebRTC + VideoCallPanel 浮层；admin 传呼叫回调 |
| `src/modules/chat/components/ConversationView.jsx` | 修改 | admin 在会话头显示"视频通话"按钮 |

---

## Task 1: chatHub — call:* 中继（admin 门控）

**Files:** Modify `server/chatHub.js`, `server/__tests__/chatHub.test.js`

- [ ] **Step 1: 加测试（先失败）** — 在 chatHub.test.js 末尾加：

```js
describe('chatHub call signaling', () => {
  function adminConn(id) { const c = fakeConn(id); c.isAdmin = true; return c; }

  it('relays call:offer from an admin to a friend (with from)', async () => {
    const hub = createChatHub({ persist: vi.fn(), getFriends: async () => new Set([1, 2]), now: () => 1 });
    const a = adminConn(1), b = fakeConn(2);
    await hub.addConnection(a); await hub.addConnection(b);
    await hub.handleMessage(a, JSON.stringify({ type: 'call:offer', to: 2, sdp: 'OFFER' }));
    expect(has(b, (m) => m.type === 'call:offer' && m.from === 1 && m.sdp === 'OFFER')).toBe(true);
  });

  it('REJECTS call:offer from a non-admin', async () => {
    const hub = createChatHub({ persist: vi.fn(), getFriends: async () => new Set([1, 2]), now: () => 1 });
    const a = fakeConn(1), b = fakeConn(2);          // a NOT admin
    await hub.addConnection(a); await hub.addConnection(b);
    await hub.handleMessage(a, JSON.stringify({ type: 'call:offer', to: 2, sdp: 'X' }));
    expect(has(b, (m) => m.type === 'call:offer')).toBe(false);
    expect(has(a, (m) => m.type === 'call:error' && m.error === 'not allowed')).toBe(true);
  });

  it('relays call:answer / call:ice / call:hangup between friends (non-admin allowed)', async () => {
    const hub = createChatHub({ persist: vi.fn(), getFriends: async () => new Set([1, 2]), now: () => 1 });
    const a = adminConn(1), b = fakeConn(2);
    await hub.addConnection(a); await hub.addConnection(b);
    await hub.handleMessage(b, JSON.stringify({ type: 'call:answer', to: 1, sdp: 'ANS' }));
    await hub.handleMessage(b, JSON.stringify({ type: 'call:ice', to: 1, candidate: 'C' }));
    await hub.handleMessage(b, JSON.stringify({ type: 'call:hangup', to: 1 }));
    expect(has(a, (m) => m.type === 'call:answer' && m.from === 2 && m.sdp === 'ANS')).toBe(true);
    expect(has(a, (m) => m.type === 'call:ice' && m.from === 2 && m.candidate === 'C')).toBe(true);
    expect(has(a, (m) => m.type === 'call:hangup' && m.from === 2)).toBe(true);
  });

  it('rejects call:* to a non-friend', async () => {
    const hub = createChatHub({ persist: vi.fn(), getFriends: async () => new Set(), now: () => 1 });
    const a = adminConn(1);
    await hub.addConnection(a);
    await hub.handleMessage(a, JSON.stringify({ type: 'call:offer', to: 9, sdp: 'X' }));
    expect(a.sent.some((m) => m.type === 'call:offer')).toBe(false);
  });
});
```

- [ ] **Step 2: 运行确认失败** — `npx vitest run server/__tests__/chatHub.test.js`

- [ ] **Step 3: 实现** — 在 chatHub.js `handleMessage` 里，把现有的 `// call:* (Phase 3...)` 注释替换为：

```js
    if (msg.type === 'call:offer' || msg.type === 'call:answer' || msg.type === 'call:ice' || msg.type === 'call:hangup') {
      const to = Number(msg.to);
      if (!Number.isFinite(to)) return;
      if (msg.type === 'call:offer' && !conn.isAdmin) {     // 仅管理员可发起
        conn.send({ type: 'call:error', error: 'not allowed' });
        return;
      }
      if (!(await isFriendOf(conn, to))) return;            // 都要是好友
      const out = { type: msg.type, from: conn.userId, to };
      if (msg.sdp != null) out.sdp = msg.sdp;
      if (msg.candidate != null) out.candidate = msg.candidate;
      sendTo(to, out);
      return;
    }
```
（注意：放在 chat:message 分支之后、函数结尾的注释处。`call:*` 帧大小：SDP 通常几 KB，远小于 16KB maxPayload。）

- [ ] **Step 4: 运行确认通过** — `npx vitest run server/__tests__/chatHub.test.js`

- [ ] **Step 5: Commit**
```bash
git add server/chatHub.js server/__tests__/chatHub.test.js
git commit -m "feat(chat): relay WebRTC call signaling, admin-gated offer (phase 3)"
```

---

## Task 2: useChatSocket — 通用 sendSignal

**Files:** Modify `src/hooks/useChatSocket.js`

- [ ] **Step 1: 加 sendSignal** — 在 `send`/`sendTyping` 旁加：
```js
  const sendSignal = useCallback((obj) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify(obj)); return true; }
    return false;
  }, []);
```
并加入 return 的对象与其 deps：`return useMemo(() => ({ status, onlineFriends, reconnectNonce, send, sendTyping, sendSignal, subscribe }), [status, onlineFriends, reconnectNonce, send, sendTyping, sendSignal, subscribe]);`

- [ ] **Step 2: Commit**（与 Task 3 一起）。

---

## Task 3: webrtcReducer（纯状态机）+ 测试

**Files:** Create `src/modules/chat/webrtcReducer.js`, `src/modules/chat/__tests__/webrtcReducer.test.js`

- [ ] **Step 1: 写失败测试**

```js
import { describe, expect, it } from 'vitest';
import { webrtcReducer, initialCallState } from '../webrtcReducer.js';

const s0 = initialCallState;
describe('webrtcReducer', () => {
  it('admin START_CALL -> calling', () => {
    const s = webrtcReducer(s0, { type: 'START_CALL', peerId: 2, peerName: 'bob' });
    expect(s.phase).toBe('calling'); expect(s.peerId).toBe(2);
  });
  it('INCOMING_OFFER -> ringing', () => {
    const s = webrtcReducer(s0, { type: 'INCOMING_OFFER', peerId: 1, peerName: 'alice' });
    expect(s.phase).toBe('ringing'); expect(s.peerId).toBe(1);
  });
  it('ACCEPT (from ringing) -> connecting', () => {
    const r = webrtcReducer(s0, { type: 'INCOMING_OFFER', peerId: 1 });
    expect(webrtcReducer(r, { type: 'ACCEPT' }).phase).toBe('connecting');
  });
  it('ANSWERED (caller, from calling) -> connecting', () => {
    const c = webrtcReducer(s0, { type: 'START_CALL', peerId: 2 });
    expect(webrtcReducer(c, { type: 'ANSWERED' }).phase).toBe('connecting');
  });
  it('CONNECTED -> connected', () => {
    const c = webrtcReducer({ ...s0, phase: 'connecting', peerId: 2 }, { type: 'CONNECTED' });
    expect(c.phase).toBe('connected');
  });
  it('HANGUP / REMOTE_HANGUP / ERROR / REJECT -> idle (reset)', () => {
    const live = { ...s0, phase: 'connected', peerId: 2, peerName: 'b' };
    for (const t of ['HANGUP', 'REMOTE_HANGUP', 'ERROR', 'REJECT']) {
      expect(webrtcReducer(live, { type: t }).phase).toBe('idle');
    }
  });
  it('ignores INCOMING_OFFER while already in a call (busy)', () => {
    const live = { ...s0, phase: 'connected', peerId: 2 };
    const s = webrtcReducer(live, { type: 'INCOMING_OFFER', peerId: 3 });
    expect(s.phase).toBe('connected'); expect(s.peerId).toBe(2);  // unchanged
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 写实现**

```js
/**
 * webrtcReducer — 通话状态机（纯函数，不碰 RTCPeerConnection/媒体）。
 * phase: idle | calling(主叫等待) | ringing(被叫待接) | connecting(协商中) | connected | error
 */
export const initialCallState = { phase: 'idle', peerId: null, peerName: null, error: null };

export function webrtcReducer(state, action) {
  switch (action.type) {
    case 'START_CALL':
      if (state.phase !== 'idle') return state;            // 忙时不重复发起
      return { phase: 'calling', peerId: Number(action.peerId), peerName: action.peerName ?? null, error: null };
    case 'INCOMING_OFFER':
      if (state.phase !== 'idle') return state;            // 忙时忽略新来电（被叫端会回 hangup busy）
      return { phase: 'ringing', peerId: Number(action.peerId), peerName: action.peerName ?? null, error: null };
    case 'ACCEPT':
      if (state.phase !== 'ringing') return state;
      return { ...state, phase: 'connecting' };
    case 'ANSWERED':
      if (state.phase !== 'calling') return state;
      return { ...state, phase: 'connecting' };
    case 'CONNECTED':
      if (state.phase !== 'connecting') return state;
      return { ...state, phase: 'connected' };
    case 'ERROR':
      return { ...initialCallState, phase: 'idle', error: action.error ?? 'error' };
    case 'HANGUP':
    case 'REMOTE_HANGUP':
    case 'REJECT':
      return { ...initialCallState };
    default:
      return state;
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

- [ ] **Step 5: Commit**（含 Task 2）
```bash
git add src/hooks/useChatSocket.js src/modules/chat/webrtcReducer.js src/modules/chat/__tests__/webrtcReducer.test.js
git commit -m "feat(chat): webrtc call state reducer + sendSignal (phase 3)"
```

---

## Task 4: useWebRTC hook（接线层）

**Files:** Create `src/hooks/useWebRTC.js`

> 不可在 jsdom 单测（依赖 RTCPeerConnection/getUserMedia）；逻辑尽量薄，状态走 reducer，手动验证。

- [ ] **Step 1: 写实现**

```js
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { webrtcReducer, initialCallState } from '../modules/chat/webrtcReducer';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

/**
 * useWebRTC — 1对1 视频通话。信令通过 chat.sendSignal / chat.subscribe。
 * 媒体 P2P（STUN）。仅 admin 能 startCall（UI 也会隐藏按钮，服务端再校验）。
 *
 * 返回 { state, localStream, remoteStream, muted, cameraOff,
 *        startCall(peerId,name), accept(), reject(), hangup(), toggleMute(), toggleCamera() }
 */
export function useWebRTC({ chat, isAdmin }) {
  const [state, dispatch] = useReducer(webrtcReducer, initialCallState);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const pcRef = useRef(null);
  const localRef = useRef(null);
  const peerRef = useRef(null);                 // 当前对端 id
  const pendingOffer = useRef(null);            // ringing 时暂存 offer sdp
  const pendingIce = useRef([]);                // remoteDescription 之前缓存的 candidate

  const cleanup = useCallback(() => {
    try { pcRef.current?.close(); } catch { /* noop */ }
    pcRef.current = null;
    localRef.current?.getTracks().forEach((t) => { try { t.stop(); } catch { /* noop */ } });
    localRef.current = null;
    peerRef.current = null;
    pendingOffer.current = null;
    pendingIce.current = [];
    setLocalStream(null); setRemoteStream(null); setMuted(false); setCameraOff(false);
  }, []);

  const newPc = useCallback((peerId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => { if (e.candidate) chat.sendSignal({ type: 'call:ice', to: peerId, candidate: e.candidate }); };
    pc.ontrack = (e) => setRemoteStream(e.streams[0]);
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') dispatch({ type: 'CONNECTED' });
      else if (st === 'failed' || st === 'disconnected' || st === 'closed') {
        if (st === 'failed') dispatch({ type: 'ERROR', error: '连接失败（可能需要 TURN）' });
      }
    };
    pcRef.current = pc;
    return pc;
  }, [chat]);

  async function getMedia() {
    const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localRef.current = s; setLocalStream(s);
    return s;
  }
  async function drainIce() {
    const pc = pcRef.current; if (!pc) return;
    for (const c of pendingIce.current) { try { await pc.addIceCandidate(c); } catch { /* ignore */ } }
    pendingIce.current = [];
  }

  // 主叫（admin）发起
  const startCall = useCallback(async (peerId, peerName) => {
    if (!isAdmin || state.phase !== 'idle') return;
    peerRef.current = Number(peerId);
    dispatch({ type: 'START_CALL', peerId, peerName });
    try {
      const media = await getMedia();
      const pc = newPc(Number(peerId));
      media.getTracks().forEach((t) => pc.addTrack(t, media));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      chat.sendSignal({ type: 'call:offer', to: Number(peerId), sdp: offer });
    } catch (e) {
      chat.sendSignal({ type: 'call:hangup', to: Number(peerId) });
      cleanup(); dispatch({ type: 'ERROR', error: e.name === 'NotAllowedError' ? '需要授权摄像头/麦克风' : e.message });
    }
  }, [isAdmin, state.phase, newPc, chat, cleanup]);

  // 被叫接听
  const accept = useCallback(async () => {
    if (state.phase !== 'ringing' || !peerRef.current || !pendingOffer.current) return;
    const peerId = peerRef.current;
    dispatch({ type: 'ACCEPT' });
    try {
      const media = await getMedia();
      const pc = newPc(peerId);
      media.getTracks().forEach((t) => pc.addTrack(t, media));
      await pc.setRemoteDescription(pendingOffer.current);
      await drainIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      chat.sendSignal({ type: 'call:answer', to: peerId, sdp: answer });
    } catch (e) {
      chat.sendSignal({ type: 'call:hangup', to: peerId });
      cleanup(); dispatch({ type: 'ERROR', error: e.name === 'NotAllowedError' ? '需要授权摄像头/麦克风' : e.message });
    }
  }, [state.phase, newPc, chat, cleanup]);

  const reject = useCallback(() => {
    if (peerRef.current) chat.sendSignal({ type: 'call:hangup', to: peerRef.current });
    cleanup(); dispatch({ type: 'REJECT' });
  }, [chat, cleanup]);

  const hangup = useCallback(() => {
    if (peerRef.current) chat.sendSignal({ type: 'call:hangup', to: peerRef.current });
    cleanup(); dispatch({ type: 'HANGUP' });
  }, [chat, cleanup]);

  const toggleMute = useCallback(() => {
    const s = localRef.current; if (!s) return;
    const on = !muted; s.getAudioTracks().forEach((t) => { t.enabled = !on; }); setMuted(on);
  }, [muted]);
  const toggleCamera = useCallback(() => {
    const s = localRef.current; if (!s) return;
    const off = !cameraOff; s.getVideoTracks().forEach((t) => { t.enabled = !off; }); setCameraOff(off);
  }, [cameraOff]);

  // 信令订阅
  useEffect(() => {
    return chat.subscribe(async (msg) => {
      if (msg.type === 'call:offer') {
        if (state.phase !== 'idle') { chat.sendSignal({ type: 'call:hangup', to: Number(msg.from) }); return; } // 忙
        peerRef.current = Number(msg.from);
        pendingOffer.current = msg.sdp;
        dispatch({ type: 'INCOMING_OFFER', peerId: msg.from });
      } else if (msg.type === 'call:answer') {
        const pc = pcRef.current; if (!pc) return;
        try { await pc.setRemoteDescription(msg.sdp); await drainIce(); dispatch({ type: 'ANSWERED' }); } catch { /* ignore */ }
      } else if (msg.type === 'call:ice') {
        const pc = pcRef.current;
        if (pc && pc.remoteDescription) { try { await pc.addIceCandidate(msg.candidate); } catch { /* ignore */ } }
        else pendingIce.current.push(msg.candidate);       // 远端描述前先缓存
      } else if (msg.type === 'call:hangup') {
        if (Number(msg.from) === peerRef.current) { cleanup(); dispatch({ type: 'REMOTE_HANGUP' }); }
      } else if (msg.type === 'call:error') {
        cleanup(); dispatch({ type: 'ERROR', error: msg.error });
      }
    });
  }, [chat, state.phase, cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);             // 卸载清理

  return { state, localStream, remoteStream, muted, cameraOff, startCall, accept, reject, hangup, toggleMute, toggleCamera };
}
```

- [ ] **Step 2: 语法检查** — `node --check` 不适用 JSX/hook；靠 `npm run build` 在 Task 6 验证。**Task 4 不单独 commit**（与 Task 5 一起构建后提交）。

---

## Task 5: VideoCallPanel + ChatRoute/ConversationView 接入

**Files:** Create `VideoCallPanel.jsx`, test; Modify `ChatRoute.jsx`, `ConversationView.jsx`

- [ ] **Step 1: VideoCallPanel 冒烟测试（失败）**

`src/modules/chat/__tests__/videoCallPanel.test.jsx`:
```jsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VideoCallPanel } from '../components/VideoCallPanel.jsx';

const noop = () => {};
const base = { localStream: null, remoteStream: null, muted: false, cameraOff: false,
  accept: noop, reject: noop, hangup: noop, toggleMute: noop, toggleCamera: noop };

describe('VideoCallPanel', () => {
  it('renders nothing when idle', () => {
    const html = renderToStaticMarkup(<VideoCallPanel state={{ phase: 'idle' }} {...base} nameOf={() => 'x'} />);
    expect(html).toBe('');
  });
  it('shows incoming-call controls when ringing', () => {
    const html = renderToStaticMarkup(<VideoCallPanel state={{ phase: 'ringing', peerId: 1 }} {...base} nameOf={() => 'alice'} />);
    expect(html).toContain('接听'); expect(html).toContain('拒绝'); expect(html).toContain('alice');
  });
  it('shows hangup when connected', () => {
    const html = renderToStaticMarkup(<VideoCallPanel state={{ phase: 'connected', peerId: 1 }} {...base} nameOf={() => 'alice'} />);
    expect(html).toContain('挂断');
  });
  it('shows calling state', () => {
    const html = renderToStaticMarkup(<VideoCallPanel state={{ phase: 'calling', peerId: 1 }} {...base} nameOf={() => 'bob'} />);
    expect(html).toContain('呼叫');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 写 VideoCallPanel.jsx**

```jsx
import React, { useEffect, useRef } from 'react';

function Video({ stream, muted, className }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null; }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />;
}

/**
 * VideoCallPanel — 来电/通话浮层。state.phase: idle 时不渲染。
 * props: state, localStream, remoteStream, muted, cameraOff,
 *        accept, reject, hangup, toggleMute, toggleCamera, nameOf(id)->string
 */
export function VideoCallPanel({ state, localStream, remoteStream, muted, cameraOff, accept, reject, hangup, toggleMute, toggleCamera, nameOf }) {
  if (!state || state.phase === 'idle') return null;
  const name = nameOf ? nameOf(state.peerId) : `#${state.peerId}`;

  if (state.phase === 'ringing') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-white rounded-lg p-6 text-center space-y-4">
          <p className="text-ink">{name} 邀请你视频通话</p>
          <div className="flex gap-4 justify-center">
            <button type="button" onClick={accept} className="px-4 py-2 rounded bg-green-600 text-white">接听</button>
            <button type="button" onClick={reject} className="px-4 py-2 rounded bg-red-600 text-white">拒绝</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex-1 relative">
        <Video stream={remoteStream} className="w-full h-full object-contain bg-black" />
        <Video stream={localStream} muted className="absolute bottom-4 right-4 w-40 rounded border border-white/30" />
        {state.phase === 'calling' && <p className="absolute top-6 left-0 right-0 text-center text-white">正在呼叫 {name}…</p>}
        {state.phase === 'connecting' && <p className="absolute top-6 left-0 right-0 text-center text-white">连接中…</p>}
        {state.error && <p className="absolute top-16 left-0 right-0 text-center text-red-300">{state.error}</p>}
      </div>
      <div className="flex gap-3 justify-center p-4 bg-zinc-900">
        <button type="button" onClick={toggleMute} className="px-3 py-2 rounded bg-zinc-700 text-white">{muted ? '取消静音' : '静音'}</button>
        <button type="button" onClick={toggleCamera} className="px-3 py-2 rounded bg-zinc-700 text-white">{cameraOff ? '开摄像头' : '关摄像头'}</button>
        <button type="button" onClick={hangup} className="px-4 py-2 rounded bg-red-600 text-white">挂断</button>
      </div>
    </div>
  );
}

export default VideoCallPanel;
```

- [ ] **Step 4: 跑测试确认通过**

- [ ] **Step 5: 接入 ChatRoute** — 修改 `src/modules/chat/ChatRoute.jsx`：
1. import：
```jsx
import { useAuth } from '../../contexts/AuthContext';
import { useWebRTC } from '../../hooks/useWebRTC';
import { VideoCallPanel } from './components/VideoCallPanel';
```
2. 组件内（`const chat = ...` 之后）：
```jsx
  const { isAdmin } = useAuth();
  const webrtc = useWebRTC({ chat, isAdmin });
  const nameOf = useCallback((id) => friends.find((f) => Number(f.id) === Number(id))?.username ?? `#${id}`, [friends]);
```
3. ConversationView 传呼叫回调（仅 admin 给）：
```jsx
        {selectedFriend && (
          <ConversationView api={api} meId={user.id} friend={selectedFriend} chat={chat}
            onStartCall={isAdmin ? () => webrtc.startCall(selectedFriend.id, selectedFriend.username) : null} />
        )}
```
4. 在最外层 div 末尾（`</div>` 之前）加浮层：
```jsx
      <VideoCallPanel
        state={webrtc.state} localStream={webrtc.localStream} remoteStream={webrtc.remoteStream}
        muted={webrtc.muted} cameraOff={webrtc.cameraOff}
        accept={webrtc.accept} reject={webrtc.reject} hangup={webrtc.hangup}
        toggleMute={webrtc.toggleMute} toggleCamera={webrtc.toggleCamera} nameOf={nameOf}
      />
```

- [ ] **Step 6: ConversationView 加视频按钮** — 修改会话头：
```jsx
export function ConversationView({ api, meId, friend, chat, onStartCall }) {
  // ...header 里 friend.username 旁加：
        {onStartCall && (
          <button type="button" onClick={onStartCall} className="ml-auto text-sm text-amber-700">视频通话</button>
        )}
```
（把 onStartCall 加入 props 解构；按钮仅当 onStartCall 非空即 admin 时渲染。）

- [ ] **Step 7: 构建 + 全量测试**
```bash
npm run build      # check-build 0 泄漏；ChatRoute chunk 含 webrtc
npm test           # 全绿（新增 chatHub call:* + reducer + VideoCallPanel 测试）
```

- [ ] **Step 8: Commit**
```bash
git add src/hooks/useWebRTC.js src/modules/chat/components/VideoCallPanel.jsx src/modules/chat/__tests__/videoCallPanel.test.jsx src/modules/chat/ChatRoute.jsx src/modules/chat/components/ConversationView.jsx
git commit -m "feat(chat): WebRTC video call UI (useWebRTC + VideoCallPanel) wired into chat (phase 3)"
```

---

## Task 6: 部署（ECS + 前端；无 Worker/D1）

- [ ] **Step 1: CHANGELOG** — 加 Phase 3 条目（WebRTC 视频、admin 发起、P2P+STUN、信令复用 WS、无 D1/Worker 改动）。
- [ ] **Step 2: push** — `git push origin main`
- [ ] **Step 3: 前端部署** — `npm run deploy` + CLAUDE.md §B 指纹核对（chatHub 改了但那是 ECS；前端 ChatRoute chunk 变化要 prod=local）。
- [ ] **Step 4: ECS 部署**（chatHub.js 改了）：
```bash
ssh <ecs> 'cd /var/www/wolfgame && git pull && pm2 restart ecosystem.config.cjs --update-env'
# server 无新依赖（WebRTC 全在前端），无需 npm install；但 git pull 后重启让 chatHub call:* 中继生效
```
- [ ] **Step 5: 真人验证** — admin 账号在会话里点「视频通话」→ 好友账号收到来电→接听→双方看到画面。测试静音/关摄像头/挂断。非 admin 账号看不到「视频通话」按钮（且即便手动发 call:offer 也被服务端拒）。

---

## Self-Review

- **Spec 覆盖**：WebRTC 视频(§5/§7)→Task3/4/5；admin 门控(§5.2 call:* 校验 isAdmin)→Task1 服务端 + Task5 前端隐藏；P2P+STUN(§7)→useWebRTC ICE_SERVERS；信令复用 WS(§5.2)→Task1 中继 + Task2 sendSignal。TURN 明确不做（决策）。
- **占位符**：无；每步含完整代码/命令。
- **类型/命名一致**：信令字段 `type/to/from/sdp/candidate` 在 chatHub、useWebRTC、测试一致；reducer action（START_CALL/INCOMING_OFFER/ACCEPT/ANSWERED/CONNECTED/HANGUP/REMOTE_HANGUP/REJECT/ERROR）在 reducer 与 useWebRTC dispatch 一致；`webrtc.{state,startCall,accept,reject,hangup,toggleMute,toggleCamera,...}` 在 hook、ChatRoute、VideoCallPanel 一致。
- **测试现实**：useWebRTC 不可 jsdom 单测（无 RTCPeerConnection/getUserMedia）→ 逻辑抽进可测的 webrtcReducer；其余（chatHub 中继、reducer、VideoCallPanel）有单测；端到端视频靠真人手测（spec §9 / browse 限制）。
- **安全**：call:offer 服务端强制 isAdmin（前端隐藏不算边界）；call:* 走好友校验；媒体 P2P 不过服务器；SDP/ICE 帧 < 16KB maxPayload。
- **已知边界（adversarial review 重点核）**：忙线（in-call 收到新 offer → 回 hangup busy）；ICE 候选早到缓存（pendingIce）；权限拒绝（NotAllowedError 提示）；卸载/挂断清理（停轨道+关 pc）；连接失败（connectionState failed → 提示可能需 TURN）；glare 因非对称发起天然不存在。
