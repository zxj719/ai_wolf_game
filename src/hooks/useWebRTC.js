import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { webrtcReducer, initialCallState } from '../modules/chat/webrtcReducer';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const RING_TIMEOUT_MS = 45000;
export const SHARE_RES = { '720p': { width: 1280, height: 720 }, '1080p': { width: 1920, height: 1080 } };

/**
 * useWebRTC — 1对1 视频通话 + 屏幕共享（屏幕与摄像头同时，预协商第二条视频轨）。
 *
 * 设计要点（对抗评审修订）：
 *   - 远端轨按 transceiver.kind 识别（video[0]=camera, video[1]=screen），绝不用 receiver.track.kind
 *   - 远端流身份稳定（原地增删轨，不每次 new MediaStream），远端音频独立常驻
 *   - setupAnswerer await replaceTrack 再 createAnswer
 *   - 屏幕共享 sharingRef 闩 + 捕获 sender 身份，防选择器期间跨通话泄漏
 */
export function useWebRTC({ chat, isAdmin }) {
  const { subscribe, sendSignal } = chat;
  const [state, dispatch] = useReducer(webrtcReducer, initialCallState);
  const [localStream, setLocalStream] = useState(null);
  const [remoteCameraStream, setRemoteCameraStream] = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [remoteAudioStream, setRemoteAudioStream] = useState(null);
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [remoteSharing, setRemoteSharing] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const pcRef = useRef(null);
  const localRef = useRef(null);
  const peerRef = useRef(null);
  const pendingOffer = useRef(null);
  const pendingIce = useRef([]);
  const phaseRef = useRef(state.phase);
  const ringTimer = useRef(null);
  const taskRef = useRef(Promise.resolve());
  const screenSenderRef = useRef(null);
  const screenTrackRef = useRef(null);     // the getDisplayMedia MediaStream
  const sharingRef = useRef(false);
  const stopScreenShareRef = useRef(null);
  // 稳定的远端流（原地增删轨，避免 srcObject 反复重绑）
  const remoteCamRef = useRef(null);
  const remoteScreenRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => { phaseRef.current = state.phase; }, [state.phase]);

  const clearRingTimer = useCallback(() => {
    if (ringTimer.current) { clearTimeout(ringTimer.current); ringTimer.current = null; }
  }, []);

  // 原地同步流的单轨：仅首次创建时 setState，之后增删轨不改流身份。
  function syncStream(ref, setState, track) {
    let s = ref.current;
    if (!s) {
      if (!track) return;
      s = new MediaStream([track]); ref.current = s; setState(s); return;
    }
    s.getTracks().forEach((t) => { if (t !== track) s.removeTrack(t); });
    if (track && !s.getTracks().includes(track)) s.addTrack(track);
  }

  // 按 transceiver.kind 识别：video[0]=camera, video[1]=screen；audio 独立。
  const remapRemote = useCallback(() => {
    const pc = pcRef.current; if (!pc) return;
    const vtx = pc.getTransceivers().filter((t) => t.kind === 'video');
    const atx = pc.getTransceivers().find((t) => t.kind === 'audio');
    syncStream(remoteCamRef, setRemoteCameraStream, vtx[0]?.receiver?.track || null);
    syncStream(remoteScreenRef, setRemoteScreenStream, vtx[1]?.receiver?.track || null);
    syncStream(remoteAudioRef, setRemoteAudioStream, atx?.receiver?.track || null);
  }, []);

  const cleanup = useCallback(() => {
    clearRingTimer();
    if (screenTrackRef.current) {
      screenTrackRef.current.getTracks().forEach((t) => { t.onended = null; try { t.stop(); } catch { /* noop */ } });
    }
    screenTrackRef.current = null; screenSenderRef.current = null; sharingRef.current = false;
    try { pcRef.current?.close(); } catch { /* noop */ }
    pcRef.current = null;
    localRef.current?.getTracks().forEach((t) => { try { t.stop(); } catch { /* noop */ } });
    localRef.current = null;
    peerRef.current = null;
    pendingOffer.current = null;
    pendingIce.current = [];
    remoteCamRef.current = null; remoteScreenRef.current = null; remoteAudioRef.current = null;
    setLocalStream(null); setRemoteCameraStream(null); setRemoteScreenStream(null); setRemoteAudioStream(null);
    setLocalScreenStream(null); setSharingScreen(false); setRemoteSharing(false);
    setMuted(false); setCameraOff(false);
  }, [clearRingTimer]);

  const cleanupRef = useRef(cleanup);
  useEffect(() => { cleanupRef.current = cleanup; }, [cleanup]);

  const drainIce = useCallback(async (pc) => {
    while (pendingIce.current.length) {
      const c = pendingIce.current.shift();
      try { await pc.addIceCandidate(c); } catch { /* ignore */ }
    }
  }, []);

  const newPc = useCallback((peerId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const c = e.candidate.toJSON
        ? e.candidate.toJSON()
        : { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex, usernameFragment: e.candidate.usernameFragment };
      sendSignal({ type: 'call:ice', to: peerId, candidate: c });
    };
    pc.ontrack = () => remapRemote();
    const onConnected = () => { clearRingTimer(); dispatch({ type: 'CONNECTED' }); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') onConnected();
      else if (pc.connectionState === 'failed') dispatch({ type: 'ERROR', error: '连接失败（可能需要 TURN）' });
    };
    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState;
      if (st === 'connected' || st === 'completed') onConnected();
      else if (st === 'failed') dispatch({ type: 'ERROR', error: '连接失败（可能需要 TURN）' });
    };
    pcRef.current = pc;
    return pc;
  }, [sendSignal, clearRingTimer, remapRemote]);

  async function getMedia() {
    const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localRef.current = s; setLocalStream(s);
    return s;
  }
  function mediaError(e) {
    return e?.name === 'NotAllowedError' ? '需要授权摄像头/麦克风' : (e?.message || '通话失败');
  }

  // offerer：video[0]=camera, audio, video[1]=screen（顺序勿改）
  function setupOfferer(pc, media) {
    const cam = media.getVideoTracks()[0];
    const mic = media.getAudioTracks()[0];
    if (cam) pc.addTrack(cam, media);
    if (mic) pc.addTrack(mic, media);
    const screenTx = pc.addTransceiver('video', { direction: 'sendrecv' });
    screenSenderRef.current = screenTx.sender;
  }
  // answerer：按 kind 选发送槽（不靠 receiver.track），await replaceTrack 再 createAnswer
  async function setupAnswerer(pc, media) {
    const videoTx = pc.getTransceivers().filter((t) => t.kind === 'video');
    const audioTx = pc.getTransceivers().find((t) => t.kind === 'audio');
    const cam = media.getVideoTracks()[0];
    const mic = media.getAudioTracks()[0];
    screenSenderRef.current = videoTx[1]?.sender || null;
    const ps = [];
    if (videoTx[0] && cam) ps.push(videoTx[0].sender.replaceTrack(cam));
    if (audioTx && mic) ps.push(audioTx.sender.replaceTrack(mic));
    await Promise.all(ps);
  }

  const startCall = useCallback(async (peerId, peerName) => {
    if (!isAdmin || phaseRef.current !== 'idle') return;
    const pid = Number(peerId);
    peerRef.current = pid;
    dispatch({ type: 'START_CALL', peerId: pid, peerName });
    ringTimer.current = setTimeout(() => {
      sendSignal({ type: 'call:hangup', to: pid });
      cleanupRef.current(); dispatch({ type: 'ERROR', error: '对方未接听' });
    }, RING_TIMEOUT_MS);
    try {
      const media = await getMedia();
      if (peerRef.current !== pid) return;
      const pc = newPc(pid);
      setupOfferer(pc, media);
      const offer = await pc.createOffer();
      if (pcRef.current !== pc) return;
      await pc.setLocalDescription(offer);
      if (pcRef.current !== pc) return;
      sendSignal({ type: 'call:offer', to: pid, sdp: offer });
    } catch (e) {
      sendSignal({ type: 'call:hangup', to: pid });
      cleanupRef.current(); dispatch({ type: 'ERROR', error: mediaError(e) });
    }
  }, [isAdmin, sendSignal, newPc]);

  const accept = useCallback(async () => {
    if (phaseRef.current !== 'ringing' || !peerRef.current || !pendingOffer.current) return;
    const pid = peerRef.current;
    const offer = pendingOffer.current;
    dispatch({ type: 'ACCEPT' });
    try {
      const media = await getMedia();
      if (peerRef.current !== pid) return;
      const pc = newPc(pid);
      await pc.setRemoteDescription(offer);
      if (pcRef.current !== pc) return;
      await setupAnswerer(pc, media);
      if (pcRef.current !== pc) return;
      await drainIce(pc);
      const answer = await pc.createAnswer();
      if (pcRef.current !== pc) return;
      await pc.setLocalDescription(answer);
      if (pcRef.current !== pc) return;
      sendSignal({ type: 'call:answer', to: pid, sdp: answer });
      remapRemote();
    } catch (e) {
      sendSignal({ type: 'call:hangup', to: pid });
      cleanupRef.current(); dispatch({ type: 'ERROR', error: mediaError(e) });
    }
  }, [sendSignal, newPc, drainIce, remapRemote]);

  const reject = useCallback(() => {
    if (peerRef.current) sendSignal({ type: 'call:hangup', to: peerRef.current });
    cleanupRef.current(); dispatch({ type: 'REJECT' });
  }, [sendSignal]);

  const hangup = useCallback(() => {
    if (peerRef.current) sendSignal({ type: 'call:hangup', to: peerRef.current });
    cleanupRef.current(); dispatch({ type: 'HANGUP' });
  }, [sendSignal]);

  const dismiss = useCallback(() => { cleanupRef.current(); dispatch({ type: 'DISMISS' }); }, []);

  const toggleMute = useCallback(() => {
    const s = localRef.current; if (!s) return;
    const on = !muted; s.getAudioTracks().forEach((t) => { t.enabled = !on; }); setMuted(on);
  }, [muted]);
  const toggleCamera = useCallback(() => {
    const s = localRef.current; if (!s) return;
    const off = !cameraOff; s.getVideoTracks().forEach((t) => { t.enabled = !off; }); setCameraOff(off);
  }, [cameraOff]);

  // ── 屏幕共享 ──────────────────────────────────────────────
  const stopScreenShare = useCallback(() => {
    if (!screenTrackRef.current && !sharingRef.current) return;
    const peer = peerRef.current;
    if (screenTrackRef.current) {
      screenTrackRef.current.getTracks().forEach((t) => { t.onended = null; try { t.stop(); } catch { /* noop */ } });
    }
    screenTrackRef.current = null;
    try { screenSenderRef.current?.replaceTrack(null); } catch { /* noop */ }
    sharingRef.current = false;
    setLocalScreenStream(null); setSharingScreen(false);
    if (peer) sendSignal({ type: 'call:screenshare', to: peer, on: false });
  }, [sendSignal]);
  useEffect(() => { stopScreenShareRef.current = stopScreenShare; }, [stopScreenShare]);

  const startScreenShare = useCallback(async (resolution) => {
    if (sharingRef.current || screenTrackRef.current) return;
    if (!screenSenderRef.current) { dispatch({ type: 'ERROR', error: '当前通话不支持屏幕共享' }); return; }
    if (!navigator.mediaDevices?.getDisplayMedia) return;
    sharingRef.current = true;
    const sender = screenSenderRef.current;          // 捕获身份
    const r = SHARE_RES[resolution] || SHARE_RES['1080p'];
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: r.width }, height: { ideal: r.height }, frameRate: { ideal: 30 } },
        audio: false,
      });
      if (screenSenderRef.current !== sender) { s.getTracks().forEach((t) => t.stop()); sharingRef.current = false; return; }
      const track = s.getVideoTracks()[0];
      screenTrackRef.current = s;
      await sender.replaceTrack(track);
      if (screenSenderRef.current !== sender) { s.getTracks().forEach((t) => t.stop()); screenTrackRef.current = null; sharingRef.current = false; return; }
      track.onended = () => stopScreenShareRef.current?.();   // 浏览器“停止共享”
      setLocalScreenStream(s); setSharingScreen(true);
      if (peerRef.current) sendSignal({ type: 'call:screenshare', to: peerRef.current, on: true });
    } catch (e) {
      sharingRef.current = false;
      if (e?.name !== 'NotAllowedError') dispatch({ type: 'ERROR', error: '屏幕共享失败' });
    }
  }, [sendSignal]);

  const applyShareResolution = useCallback((resolution) => {
    const r = SHARE_RES[resolution]; if (!r || !screenTrackRef.current) return;
    const t = screenTrackRef.current.getVideoTracks()[0];
    try { t?.applyConstraints({ width: { ideal: r.width }, height: { ideal: r.height } }); } catch { /* noop */ }
  }, []);

  // ── 信令订阅（只订一次，串行化，读实时 ref）──────────────
  useEffect(() => {
    const handle = async (msg) => {
      if (msg.type === 'call:offer') {
        if (pcRef.current || peerRef.current) { sendSignal({ type: 'call:hangup', to: Number(msg.from), reason: 'busy' }); return; }
        peerRef.current = Number(msg.from);
        pendingOffer.current = msg.sdp;
        dispatch({ type: 'INCOMING_OFFER', peerId: msg.from });
      } else if (msg.type === 'call:answer') {
        const pc = pcRef.current; if (!pc) return;
        try { await pc.setRemoteDescription(msg.sdp); await drainIce(pc); remapRemote(); dispatch({ type: 'ANSWERED' }); }
        catch (e) { if (peerRef.current) sendSignal({ type: 'call:hangup', to: peerRef.current }); cleanupRef.current(); dispatch({ type: 'ERROR', error: e?.message || '协商失败' }); }
      } else if (msg.type === 'call:ice') {
        const pc = pcRef.current;
        pendingIce.current.push(msg.candidate);
        if (pc && pc.remoteDescription) await drainIce(pc);
      } else if (msg.type === 'call:screenshare') {
        if (Number(msg.from) === peerRef.current) setRemoteSharing(!!msg.on);
      } else if (msg.type === 'call:hangup') {
        if (Number(msg.from) === peerRef.current) { cleanupRef.current(); dispatch({ type: 'REMOTE_HANGUP' }); }
      } else if (msg.type === 'call:error') {
        cleanupRef.current(); dispatch({ type: 'ERROR', error: msg.error || 'error' });
      }
    };
    const unsub = subscribe((msg) => {
      if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('call:')) return;
      taskRef.current = taskRef.current.then(() => handle(msg)).catch(() => {});
    });
    return unsub;
  }, [subscribe, sendSignal, drainIce, remapRemote]);

  useEffect(() => () => cleanupRef.current(), []);

  return {
    state, localStream, remoteCameraStream, remoteScreenStream, remoteAudioStream, localScreenStream,
    sharingScreen, remoteSharing, muted, cameraOff,
    startCall, accept, reject, hangup, dismiss, toggleMute, toggleCamera,
    startScreenShare, stopScreenShare, applyShareResolution,
  };
}
