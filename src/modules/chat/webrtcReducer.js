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
      if (state.phase !== 'calling') return state;         // 软转换；CONNECTED 才是权威
      return { ...state, phase: 'connecting' };
    case 'CONNECTED':
      // MUST-FIX: connectionState 'connected' 是一次性边沿，可能早于 ANSWERED/ACCEPT 落地。
      // 因此任意活跃阶段都接受它，否则会永远卡在 calling/connecting。
      if (state.phase === 'idle' || state.phase === 'connected' || state.phase === 'error') return state;
      return { ...state, phase: 'connected' };
    case 'ERROR':
      // 单独 error 阶段，让 UI 能显示（相机被拒/连接失败）；不要直接 reset 成 idle。
      return { phase: 'error', peerId: null, peerName: null, error: action.error ?? 'error' };
    case 'DISMISS':
    case 'HANGUP':
    case 'REMOTE_HANGUP':
    case 'REJECT':
      return { ...initialCallState };
    default:
      return state;
  }
}
