import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { webrtcReducer, initialCallState } from '../modules/chat/webrtcReducer';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const RING_TIMEOUT_MS = 45000;

/**
 * useWebRTC — 1对1 视频通话。信令通过 chat.subscribe/chat.sendSignal（两者是稳定 useCallback）。
 * 媒体 P2P（STUN）。仅 admin 能 startCall（UI 隐藏 + 服务端再校验）。
 *
 * 设计要点（对抗评审修订）：
 *   - 信令只订阅一次（依赖稳定的 subscribe，不依赖会变身份的 chat 或 state.phase）
 *   - 串行化 handler（emit 不 await）；ICE drain 原子化（shift 直到空）
 *   - 每个 await 后校验 pcRef 身份，teardown-during-setup 静默退出
 *   - CONNECTED 走 connection+iceConnection 双信号；'calling' 45s 振铃超时
 */
export function useWebRTC({ chat, isAdmin }) {
  const { subscribe, sendSignal } = chat;
  const [state, dispatch] = useReducer(webrtcReducer, initialCallState);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
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

  useEffect(() => { phaseRef.current = state.phase; }, [state.phase]);

  const clearRingTimer = useCallback(() => {
    if (ringTimer.current) { clearTimeout(ringTimer.current); ringTimer.current = null; }
  }, []);

  const cleanup = useCallback(() => {
    clearRingTimer();
    try { pcRef.current?.close(); } catch { /* noop */ }
    pcRef.current = null;
    localRef.current?.getTracks().forEach((t) => { try { t.stop(); } catch { /* noop */ } });
    localRef.current = null;
    peerRef.current = null;
    pendingOffer.current = null;
    pendingIce.current = [];
    setLocalStream(null); setRemoteStream(null); setMuted(false); setCameraOff(false);
  }, [clearRingTimer]);

  // 稳定 cleanup 引用：订阅副作用/超时回调里用它，无需把 cleanup 放进 deps。
  const cleanupRef = useRef(cleanup);
  useEffect(() => { cleanupRef.current = cleanup; }, [cleanup]);

  // ICE drain 原子化：shift 直到空，await 期间新 push 的也会被这轮取走。
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
    pc.ontrack = (e) => { if (e.streams && e.streams[0]) setRemoteStream(e.streams[0]); };
    const onConnected = () => { clearRingTimer(); dispatch({ type: 'CONNECTED' }); };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') onConnected();
      else if (pc.connectionState === 'failed') dispatch({ type: 'ERROR', error: '连接失败（可能需要 TURN）' });
    };
    pc.oniceconnectionstatechange = () => {              // Safari/relay 兜底
      const st = pc.iceConnectionState;
      if (st === 'connected' || st === 'completed') onConnected();
      else if (st === 'failed') dispatch({ type: 'ERROR', error: '连接失败（可能需要 TURN）' });
    };
    pcRef.current = pc;
    return pc;
  }, [sendSignal, clearRingTimer]);

  async function getMedia() {
    const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localRef.current = s; setLocalStream(s);
    return s;
  }
  function mediaError(e) {
    return e?.name === 'NotAllowedError' ? '需要授权摄像头/麦克风' : (e?.message || '通话失败');
  }

  // 主叫（admin）发起
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
      if (peerRef.current !== pid) return;              // 取消/超时
      const pc = newPc(pid);
      media.getTracks().forEach((t) => pc.addTrack(t, media));
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

  // 被叫接听
  const accept = useCallback(async () => {
    if (phaseRef.current !== 'ringing' || !peerRef.current || !pendingOffer.current) return;
    const pid = peerRef.current;
    const offer = pendingOffer.current;
    dispatch({ type: 'ACCEPT' });
    try {
      const media = await getMedia();
      if (peerRef.current !== pid) return;
      const pc = newPc(pid);
      media.getTracks().forEach((t) => pc.addTrack(t, media));
      await pc.setRemoteDescription(offer);
      if (pcRef.current !== pc) return;
      await drainIce(pc);
      const answer = await pc.createAnswer();
      if (pcRef.current !== pc) return;
      await pc.setLocalDescription(answer);
      if (pcRef.current !== pc) return;
      sendSignal({ type: 'call:answer', to: pid, sdp: answer });
    } catch (e) {
      sendSignal({ type: 'call:hangup', to: pid });
      cleanupRef.current(); dispatch({ type: 'ERROR', error: mediaError(e) });
    }
  }, [sendSignal, newPc, drainIce]);

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

  // 信令订阅：只订阅一次（deps 仅稳定的 subscribe/drainIce）。串行化，读实时 ref。
  useEffect(() => {
    const handle = async (msg) => {
      if (msg.type === 'call:offer') {
        if (pcRef.current || peerRef.current) { sendSignal({ type: 'call:hangup', to: Number(msg.from), reason: 'busy' }); return; }
        peerRef.current = Number(msg.from);
        pendingOffer.current = msg.sdp;
        dispatch({ type: 'INCOMING_OFFER', peerId: msg.from });
      } else if (msg.type === 'call:answer') {
        const pc = pcRef.current; if (!pc) return;
        try { await pc.setRemoteDescription(msg.sdp); await drainIce(pc); dispatch({ type: 'ANSWERED' }); }
        catch (e) { if (peerRef.current) sendSignal({ type: 'call:hangup', to: peerRef.current }); cleanupRef.current(); dispatch({ type: 'ERROR', error: e?.message || '协商失败' }); }
      } else if (msg.type === 'call:ice') {
        const pc = pcRef.current;
        pendingIce.current.push(msg.candidate);
        if (pc && pc.remoteDescription) await drainIce(pc);
      } else if (msg.type === 'call:hangup') {
        if (Number(msg.from) === peerRef.current) { cleanupRef.current(); dispatch({ type: 'REMOTE_HANGUP' }); }
      } else if (msg.type === 'call:error') {
        cleanupRef.current(); dispatch({ type: 'ERROR', error: msg.error || 'error' });
      }
    };
    const unsub = subscribe((msg) => {
      if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('call:')) return;
      taskRef.current = taskRef.current.then(() => handle(msg)).catch(() => {});   // 串行化
    });
    return unsub;
  }, [subscribe, sendSignal, drainIce]);

  useEffect(() => () => cleanupRef.current(), []);       // 卸载清理

  return { state, localStream, remoteStream, muted, cameraOff, startCall, accept, reject, hangup, dismiss, toggleMute, toggleCamera };
}
