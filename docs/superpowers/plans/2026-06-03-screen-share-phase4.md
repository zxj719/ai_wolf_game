# 屏幕共享 Phase 4 实现计划（参考钉钉/腾讯会议：屏幕+摄像头同时）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** 在 Phase 3 视频通话基础上加桌面端屏幕共享；对方**同时**看到共享屏幕（大）+ 摄像头（小窗）；通话中**双方都可**共享；桌面端按钮（getDisplayMedia 仅桌面）。

**Architecture:** **预协商第二条视频 transceiver**（camera + screen），屏幕共享 = `screenSender.replaceTrack(displayTrack)` —— **无需重新协商**，沿用 Phase 3 的稳健性。收发端按 **m-line 顺序**识别 camera vs screen（getTransceivers 有序，第 2 条 video = screen）。`call:screenshare{on}` 信令告知对端何时把屏幕提为主视图。后端只在 chatHub 加一条中继；无 D1/Worker/secret/依赖改动。

**关键既有事实：**
- Phase 3 `useWebRTC.js`：startCall/accept 里 `pc.addTrack(camera)`/`addTrack(mic)` 后 createOffer/createAnswer；`ontrack` 用 `e.streams[0]` 设 remoteStream。本期改为**显式 transceiver 管理 + 按 m-line 重映射**。
- chatHub `CALL_TYPES` 已中继 call:offer/answer/ice/hangup；加 `call:screenshare`（不 admin 门控，走好友校验）。
- VideoCallPanel 当前：remote 大 + local 小窗。本期改为会议布局（主视图=共享屏幕优先，缩略图=两路摄像头）。
- 测试：chatHub 中继可单测；VideoCallPanel 用 renderToStaticMarkup；useWebRTC 媒体逻辑 jsdom 不可测 → 手动 + 端到端。

**决策（已确认）：** 屏幕+摄像头同时（预协商 transceiver）；通话中双方都可共享；桌面端（getDisplayMedia 可用才显示按钮）。

---

## ⚠️ 对抗评审修订（实现以本节为准）

> 3 代理评审：REQUEST CHANGES（架构对，5 must-fix）。下方实现全部按此修订。

1. **按 `transceiver.kind` 识别，绝不用 `receiver.track.kind`**：`receiver.track` 可能瞬时为 null/muted（停止共享时正是如此），会让 filter 塌缩、camera↔screen 静默对调。remapRemote 与 setupAnswerer 一律 `getTransceivers().filter(t => t.kind === 'video')`（vtx[0]=camera, vtx[1]=screen 恒定）/ `.find(t => t.kind === 'audio')`。删掉草案里的死代码行。
2. **远端流身份稳定**：不要每次 ontrack `new MediaStream`。用 ref 持有一次性创建的流，按 track.id 原地增删轨（addTrack/removeTrack），仅首次创建时 setState；避免 srcObject 反复重绑导致画面闪烁/音频重缓冲。
3. **远端音频独立**：单独 `remoteAudioStream`（仅音频轨）+ 整通话**一个常驻 `<audio autoPlay>`** 承载；**所有 video 元素 muted**。这样布局切换（屏幕↔摄像头主视图）音频不中断、不重音。
4. **setupAnswerer 必须 await replaceTrack 再 createAnswer**：否则慢引擎下 answer SDP 可能把摄像头 m-line 标成 recvonly，offerer 永远收不到被叫摄像头。setupAnswerer 改 async，`await Promise.all([...replaceTrack])`；accept 里 `setRemoteDescription(offer)` → `await setupAnswerer` → drainIce → createAnswer；await 后再校验 pcRef===pc。
5. **getDisplayMedia 选择器竞态**：加同步 `sharingRef` 闩（await 前置位、catch/stop 复位）+ 捕获 `sender` 身份，await 后若 `screenSenderRef.current !== sender` 则 stop 轨并 return（防挂断/新通话期间把屏幕轨接到别的 call）。startScreenShare 不依赖 sharingScreen state。

**Should-fix（并入）：** 自己共享时**始终**显示"你正在共享"横幅 + 本地屏幕缩略图（让用户看到自己在播什么）；`track.onended` 走 `stopScreenShareRef`（防陈旧闭包/cleanup 后误发 off 信号），cleanup 先置 `onended=null` 再清 ref；无 screenSender 时点共享 → 可见 ERROR（不做哑按钮）；主视图/横幅一律 gate 在 `remoteSharing`（非 remoteScreenStream 真值，因为屏幕轨从协商起就非空但 muted）；显式 `addTrack(video)` 再 `addTrack(audio)` 再 `addTransceiver(screen)` + 注释"勿改顺序"。

---

---

## 信令新增

| type | payload | chatHub | 含义 |
|---|---|---|---|
| `call:screenshare` | `{to, on}` | 加入 CALL_TYPES，转发附 `from` + `on`（**不** admin 门控） | 通知对端"我开始/停止共享屏幕" |

---

## File Structure

| 文件 | 操作 | 职责 |
|---|---|---|
| `server/chatHub.js` | 修改 | CALL_TYPES 加 `call:screenshare`；out 带 `on` |
| `server/__tests__/chatHub.test.js` | 修改 | call:screenshare 中继用例 |
| `src/hooks/useWebRTC.js` | 修改 | 第二 video transceiver；remap remote(camera/screen)；start/stopScreenShare；remoteSharing 状态 |
| `src/modules/chat/components/VideoCallPanel.jsx` | 修改 | 会议布局（主视图+缩略图）+ 共享屏幕按钮（桌面） |
| `src/modules/chat/__tests__/videoCallPanel.test.jsx` | 修改 | 加共享按钮/主视图相关断言 |

---

## Task 1: chatHub — 中继 call:screenshare

**Files:** Modify `server/chatHub.js`, `server/__tests__/chatHub.test.js`

- [ ] **Step 1: 加测试（先失败）** — chatHub.test.js 的 call describe 里加：
```js
  it('relays call:screenshare {on} between friends (non-admin allowed)', async () => {
    const hub = createChatHub({ persist: vi.fn(), getFriends: async () => new Set([1, 2]), now: () => 1 });
    const a = adminConn(1), b = fakeConn(2);
    await hub.addConnection(a); await hub.addConnection(b);
    await hub.handleMessage(b, JSON.stringify({ type: 'call:screenshare', to: 1, on: true }));
    expect(has(a, (m) => m.type === 'call:screenshare' && m.from === 2 && m.on === true)).toBe(true);
  });
```

- [ ] **Step 2: 实现** — chatHub.js：
  1. `CALL_TYPES` 加 `'call:screenshare'`：
     ```js
     const CALL_TYPES = new Set(['call:offer', 'call:answer', 'call:ice', 'call:hangup', 'call:screenshare']);
     ```
  2. call:* 中继块里 out 加 `on` 透传（在 `if (msg.reason != null) out.reason = msg.reason;` 旁）：
     ```js
     if (msg.on != null) out.on = msg.on;
     ```
  （call:offer 仍仅 admin；screenshare 不受影响，走好友校验。）

- [ ] **Step 3: 跑测试** — `npx vitest run server/__tests__/chatHub.test.js`（期望 15 通过）

- [ ] **Step 4: Commit**
```bash
git add server/chatHub.js server/__tests__/chatHub.test.js docs/superpowers/plans/2026-06-03-screen-share-phase4.md
git commit -m "feat(chat): relay call:screenshare signaling (phase 4)"
```

---

## Task 2: useWebRTC — 第二 transceiver + 屏幕共享

**Files:** Modify `src/hooks/useWebRTC.js`

> 这是核心改动。原 `remoteStream` 拆成 `remoteCameraStream`/`remoteScreenStream`；新增 `localScreenStream`、`sharingScreen`、`remoteSharing`。

- [ ] **Step 1: 状态与 ref** — 替换 `const [remoteStream, setRemoteStream] = useState(null);` 为：
```js
  const [remoteCameraStream, setRemoteCameraStream] = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [sharingScreen, setSharingScreen] = useState(false);   // 我在共享
  const [remoteSharing, setRemoteSharing] = useState(false);   // 对方在共享
```
新增 ref：`const screenSenderRef = useRef(null); const screenTrackRef = useRef(null);`

- [ ] **Step 2: remapRemote（按 m-line 顺序识别）** — 新增（newPc 之上）：
```js
  // 按 m-line 顺序重映射远端轨：第1条 video=camera，第2条=screen；audio 并入 camera 流。
  const remapRemote = useCallback(() => {
    const pc = pcRef.current; if (!pc) return;
    const vtx = pc.getTransceivers().filter((t) => t.receiver?.track?.kind === 'video');
    const atx = pc.getTransceivers().find((t) => t.receiver?.track?.kind === 'audio');
    const cam = vtx[0]?.receiver?.track || null;
    const scr = vtx[1]?.receiver?.track || null;
    const aud = atx?.receiver?.track || null;
    setRemoteCameraStream(cam || aud ? new MediaStream([cam, aud].filter(Boolean)) : null);
    setRemoteScreenStream(scr ? new MediaStream([scr]) : null);
  }, []);
```

- [ ] **Step 3: newPc 用 remapRemote** — 把 `pc.ontrack = (e) => { if (e.streams && e.streams[0]) setRemoteStream(e.streams[0]); };` 改为：
```js
    pc.ontrack = () => remapRemote();
```
并把 newPc 的 deps 加 `remapRemote`。

- [ ] **Step 4: setup 时建第二 transceiver** — 抽一个 helper 同时给 startCall（offerer）与 accept（answerer）用：
```js
  // offerer：addTrack(camera/mic) + addTransceiver(screen)；返回后 createOffer。
  function setupOfferer(pc, media) {
    media.getTracks().forEach((t) => pc.addTrack(t, media));            // camera(video)+mic(audio)
    const screenTx = pc.addTransceiver('video', { direction: 'sendrecv' });  // 第2条 video = screen
    screenSenderRef.current = screenTx.sender;
  }
  // answerer：setRemoteDescription(offer) 后，按 m-line 把自己的 cam/mic 接上，记录 screen sender。
  function setupAnswerer(pc, media) {
    const vtx = pc.getTransceivers().filter((t) => (t.receiver?.track?.kind || t.sender?.track?.kind) === 'video' || t.receiver?.track?.kind === 'video');
    const videoTx = pc.getTransceivers().filter((t) => t.receiver?.track?.kind === 'video');
    const audioTx = pc.getTransceivers().find((t) => t.receiver?.track?.kind === 'audio');
    const cam = media.getVideoTracks()[0];
    const mic = media.getAudioTracks()[0];
    if (videoTx[0] && cam) videoTx[0].sender.replaceTrack(cam);          // 第1条 video = camera
    if (audioTx && mic) audioTx.sender.replaceTrack(mic);
    screenSenderRef.current = videoTx[1]?.sender || null;               // 第2条 video = screen
  }
```
（offerer 的 startCall 把 `media.getTracks().forEach(addTrack)` 替换为 `setupOfferer(pc, media)`；answerer 的 accept 把 addTrack 那段替换为 `await pc.setRemoteDescription(offer)` 之后调 `setupAnswerer(pc, media)`，再 createAnswer。**accept 里 setRemoteDescription 必须在 setupAnswerer 之前**，因为要按 offer 的 m-line 建好 transceiver。）

> ⚠️ 注意 accept 现有顺序：getMedia → newPc → addTrack → setRemoteDescription。本期改为：getMedia → newPc → **setRemoteDescription(offer)** → setupAnswerer(pc, media) → drainIce → createAnswer。offerer：getMedia → newPc → setupOfferer → createOffer。

- [ ] **Step 5: start/stopScreenShare** — 新增：
```js
  const stopScreenShare = useCallback(() => {
    screenTrackRef.current?.getTracks().forEach((t) => { try { t.stop(); } catch { /* noop */ } });
    screenTrackRef.current = null;
    try { screenSenderRef.current?.replaceTrack(null); } catch { /* noop */ }
    setLocalScreenStream(null); setSharingScreen(false);
    if (peerRef.current) sendSignal({ type: 'call:screenshare', to: peerRef.current, on: false });
  }, [sendSignal]);

  const startScreenShare = useCallback(async () => {
    if (!screenSenderRef.current || sharingScreen) return;
    if (!navigator.mediaDevices?.getDisplayMedia) return;
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      if (!screenSenderRef.current) { s.getTracks().forEach((t) => t.stop()); return; }  // 通话已结束
      const track = s.getVideoTracks()[0];
      screenTrackRef.current = s;
      await screenSenderRef.current.replaceTrack(track);
      track.onended = () => stopScreenShare();                 // 浏览器“停止共享”按钮
      setLocalScreenStream(s); setSharingScreen(true);
      if (peerRef.current) sendSignal({ type: 'call:screenshare', to: peerRef.current, on: true });
    } catch (e) {
      if (e?.name !== 'NotAllowedError') dispatch({ type: 'ERROR', error: '屏幕共享失败' });
      // NotAllowedError = 用户取消选择，静默
    }
  }, [sharingScreen, sendSignal, stopScreenShare]);
```

- [ ] **Step 6: 信令 handler 加 call:screenshare** — 在订阅 handler 里加分支：
```js
      } else if (msg.type === 'call:screenshare') {
        if (Number(msg.from) === peerRef.current) setRemoteSharing(!!msg.on);
```

- [ ] **Step 7: cleanup 清屏幕** — cleanup() 里加：
```js
    screenTrackRef.current?.getTracks().forEach((t) => { try { t.stop(); } catch { /* noop */ } });
    screenTrackRef.current = null; screenSenderRef.current = null;
    setRemoteCameraStream(null); setRemoteScreenStream(null); setLocalScreenStream(null);
    setSharingScreen(false); setRemoteSharing(false);
```
（删掉旧的 `setRemoteStream(null)`。）

- [ ] **Step 8: 返回值** — 把 `remoteStream` 换成新字段：
```js
  return { state, localStream, remoteCameraStream, remoteScreenStream, localScreenStream,
           sharingScreen, remoteSharing, muted, cameraOff,
           startCall, accept, reject, hangup, dismiss, toggleMute, toggleCamera,
           startScreenShare, stopScreenShare };
```

- [ ] **Step 9: 语法/构建** —（在 Task 3 后统一 `npm run build`）

---

## Task 3: VideoCallPanel — 会议布局 + 共享按钮

**Files:** Modify `src/modules/chat/components/VideoCallPanel.jsx`, test

- [ ] **Step 1: 改测试** — videoCallPanel.test.jsx 的 base 增加新 props，并加共享按钮断言：
```js
const base = {
  localStream: null, remoteCameraStream: null, remoteScreenStream: null, localScreenStream: null,
  sharingScreen: false, remoteSharing: false, muted: false, cameraOff: false,
  accept: noop, reject: noop, hangup: noop, dismiss: noop, toggleMute: noop, toggleCamera: noop,
  startScreenShare: noop, stopScreenShare: noop, canScreenShare: true, nameOf: () => 'alice',
};
// 在 connected 用例里：
  it('shows screen-share + hangup controls when connected (desktop)', () => {
    const html = renderToStaticMarkup(<VideoCallPanel state={{ phase: 'connected', peerId: 1 }} {...base} />);
    expect(html).toContain('挂断'); expect(html).toContain('共享屏幕');
  });
  it('hides screen-share button when canScreenShare=false (mobile)', () => {
    const html = renderToStaticMarkup(<VideoCallPanel state={{ phase: 'connected', peerId: 1 }} {...base} canScreenShare={false} />);
    expect(html).not.toContain('共享屏幕');
  });
```
（把旧 connected 用例里对 base 的引用更新到新字段；ringing/error/calling 用例不变。）

- [ ] **Step 2: 实现会议布局** — 替换 in-call return：
```jsx
  // 主视图：对方共享 > 我共享 > 对方摄像头；缩略图：两路摄像头
  const screenStream = remoteSharing ? remoteScreenStream : (sharingScreen ? localScreenStream : null);
  const mainStream = screenStream || remoteCameraStream;
  const mainMuted = !!screenStream || false;          // 屏幕无音轨；摄像头主视图需出声
  const thumbs = screenStream
    ? [{ s: remoteCameraStream, muted: false, key: 'rc' }, { s: localStream, muted: true, key: 'lc' }]
    : [{ s: localStream, muted: true, key: 'lc' }];

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black overflow-hidden">
      <div className="relative flex-1 min-h-0">
        <Video stream={mainStream} muted={mainMuted} className="absolute inset-0 w-full h-full object-contain" />
        {/* 远端摄像头始终承载音频：屏幕做主视图时它在缩略图里且不静音 */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 items-end">
          {thumbs.map((t) => (
            <Video key={t.key} stream={t.s} muted={t.muted} className="w-28 sm:w-44 rounded border border-white/30 shadow-lg bg-black" />
          ))}
        </div>
        {remoteSharing && <p className="absolute top-6 inset-x-0 text-center text-white/80 text-sm">{name} 正在共享屏幕</p>}
        {sharingScreen && !remoteSharing && <p className="absolute top-6 inset-x-0 text-center text-white/80 text-sm">你正在共享屏幕</p>}
        {state.phase === 'calling' && <p className="absolute top-14 inset-x-0 text-center text-white">正在呼叫 {name}…</p>}
        {state.phase === 'connecting' && <p className="absolute top-14 inset-x-0 text-center text-white">连接中…</p>}
      </div>
      <div className="shrink-0 flex flex-wrap gap-3 justify-center p-4 bg-zinc-900">
        <button type="button" onClick={toggleMute} className="px-3 py-2 rounded bg-zinc-700 text-white">{muted ? '取消静音' : '静音'}</button>
        <button type="button" onClick={toggleCamera} className="px-3 py-2 rounded bg-zinc-700 text-white">{cameraOff ? '开摄像头' : '关摄像头'}</button>
        {canScreenShare && (
          <button type="button" onClick={sharingScreen ? stopScreenShare : startScreenShare} className="px-3 py-2 rounded bg-zinc-700 text-white">
            {sharingScreen ? '停止共享' : '共享屏幕'}
          </button>
        )}
        <button type="button" onClick={hangup} className="px-4 py-2 rounded bg-red-600 text-white">挂断</button>
      </div>
    </div>
  );
```
并在组件 props 解构里加 `remoteCameraStream, remoteScreenStream, localScreenStream, sharingScreen, remoteSharing, startScreenShare, stopScreenShare, canScreenShare`（替换旧 `remoteStream`）。

- [ ] **Step 3: 跑测试** — `npx vitest run src/modules/chat/__tests__/videoCallPanel.test.jsx`

---

## 追加 UI 需求（用户补充，并入 Task 2/3）

> 全部前端，无后端改动。`DraggablePiP` 作为可复用小组件隔离拖拽/缩放逻辑。

### A. 全屏 + 隐藏状态条
- **全屏按钮**：控制栏加「全屏/退出全屏」，用 Fullscreen API：`panelRef.current.requestFullscreen()` / `document.exitFullscreen()`；监听 `fullscreenchange` 同步 `isFullscreen` 状态。panel 根 div 加 `ref={panelRef}`。
- **隐藏状态条按钮**：控制栏加「隐藏栏」按钮 → `controlsHidden=true` 隐藏整条控制栏，露出更大视频；隐藏后在角落显示一个小浮动「⋯/显示」按钮恢复。（与全屏配合即"全屏看视频"。）

### B. 摄像头框可拖动 + 拉边框缩放 + 最小化
- 新建 `src/modules/chat/components/DraggablePiP.jsx`：受控位置/尺寸的浮层容器。
  - props：`x,y,w` + `onChange({x,y,w})`、`children`、`minW=120,maxW=480`、视口内 clamp。
  - 拖动：在容器上 `onPointerDown` → `setPointerCapture` → `pointermove` 改 x/y（clamp 到视口）→ `pointerup` 释放。
  - 缩放：右下角放一个 resize handle（小三角），`onPointerDown` 单独处理 → `pointermove` 改 w（按视频宽高比同步高度，或仅控宽 + `aspect`）→ clamp [minW,maxW]。
  - 触摸/鼠标统一用 Pointer Events；handle 的 pointerdown `stopPropagation` 避免触发拖动。
- VideoCallPanel：本地摄像头缩略图用 `DraggablePiP` 包裹（位置/尺寸存 panel 内 state，默认右下）。
- **最小化摄像头按钮**：控制栏加「最小化摄像头/显示摄像头」→ `cameraMinimized` 切换；true 时不渲染摄像头缩略图（保留主视图），并在控制栏按钮文案切换。

### C. 共享屏幕分辨率（最高 1080p）
- 控制栏（或共享按钮旁）加清晰度选择 `<select>`：`720p(1280×720)` / `1080p(1920×1080)`，默认 1080p；存 `shareResolution` state。
- `startScreenShare` 用所选约束：
  ```js
  const RES = { '720p': { width: 1280, height: 720 }, '1080p': { width: 1920, height: 1080 } };
  const r = RES[shareResolution] || RES['1080p'];
  await navigator.mediaDevices.getDisplayMedia({
    video: { width: { ideal: r.width }, height: { ideal: r.height }, frameRate: { ideal: 30 } },
    audio: false,
  });
  ```
- 共享中改清晰度：对屏幕轨 `track.applyConstraints({ width:{ideal:r.width}, height:{ideal:r.height} })`（捕获面尺寸限制下尽力而为）。`startScreenShare` 接收可选 resolution 参；selector onChange 若正在共享则 applyConstraints。

### 测试补充
- VideoCallPanel：断言控制栏含「全屏」「隐藏栏」「最小化摄像头」「共享屏幕」「清晰度」选项；`canScreenShare=false` 时隐藏共享+清晰度。
- DraggablePiP：renderToStaticMarkup 冒烟（渲染 children + resize handle 存在）；拖拽/缩放数值逻辑可抽纯函数 `clampPiP({x,y,w,vw,vh,minW,maxW})` 单测。

---

## Task 4: ChatRoute 接线更新

**Files:** Modify `src/modules/chat/ChatRoute.jsx`

- [ ] **Step 1:** VideoCallPanel 的 props 从 webrtc 透传新字段，并算 canScreenShare：
```jsx
      <VideoCallPanel
        state={webrtc.state}
        localStream={webrtc.localStream}
        remoteCameraStream={webrtc.remoteCameraStream}
        remoteScreenStream={webrtc.remoteScreenStream}
        localScreenStream={webrtc.localScreenStream}
        sharingScreen={webrtc.sharingScreen} remoteSharing={webrtc.remoteSharing}
        muted={webrtc.muted} cameraOff={webrtc.cameraOff}
        accept={webrtc.accept} reject={webrtc.reject} hangup={webrtc.hangup} dismiss={webrtc.dismiss}
        toggleMute={webrtc.toggleMute} toggleCamera={webrtc.toggleCamera}
        startScreenShare={webrtc.startScreenShare} stopScreenShare={webrtc.stopScreenShare}
        canScreenShare={typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia}
        nameOf={nameOf}
      />
```

- [ ] **Step 2: 构建 + 全量测试**
```bash
npm run build      # check-build 0 泄漏
npm test           # 全绿
```

- [ ] **Step 3: Commit**
```bash
git add src/hooks/useWebRTC.js src/modules/chat/components/VideoCallPanel.jsx src/modules/chat/__tests__/videoCallPanel.test.jsx src/modules/chat/ChatRoute.jsx
git commit -m "feat(chat): screen sharing — screen+camera via pre-negotiated transceiver, meeting layout (phase 4)"
```

---

## Task 5: 部署（前端 + ECS）

- [ ] CHANGELOG 加 Phase 4 条目。
- [ ] `git push origin main`
- [ ] `npm run deploy` + 指纹核对。
- [ ] ECS：`git pull && pm2 restart ecosystem.config.cjs --update-env`（call:screenshare 中继生效；无 npm install）。
- [ ] 真人验证（两桌面账号通话中）：A 点「共享屏幕」选窗口 → B 主视图变 A 的屏幕、A 摄像头变缩略图；A 点「停止共享」/浏览器停止 → 回到摄像头；B 也能共享；移动端无「共享屏幕」按钮。

---

## Self-Review
- **决策覆盖**：屏幕+摄像头同时（预协商第2 transceiver）→Task2；双方都可（无 admin 门控）→Task1；桌面端（canScreenShare）→Task3/4。
- **无重协商**：replaceTrack 到预协商的 sendrecv transceiver，不触发 SDP 重协；沿用 Phase 3 稳健性。
- **轨识别**：收发端按 getTransceivers() m-line 顺序（video[0]=camera, video[1]=screen），ontrack 每次 remap，避免时序竞态。
- **音频**：远端音频并入 remoteCameraStream，远端摄像头视频元素不静音（屏幕做主视图时它在缩略图仍出声）；本地所有视频静音防回声。
- **测试现实**：chatHub 中继单测；VideoCallPanel 布局/按钮 renderToStaticMarkup；getDisplayMedia/transceiver jsdom 不可测 → 手动 + 端到端。
- **adversarial review 重点**：m-line 顺序在 offerer/answerer 是否一致；ontrack 时序 vs remap；replaceTrack(null) 停止共享语义；getDisplayMedia 用户取消(NotAllowedError) vs 失败；浏览器“停止共享”按钮(track.onended)；双方同时共享的主视图取舍；cleanup 是否漏停屏幕轨；audio 轨归属与回声。
