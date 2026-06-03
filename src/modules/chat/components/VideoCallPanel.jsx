import React, { useEffect, useRef } from 'react';

function Video({ stream, muted, className }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null; }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />;
}

/**
 * VideoCallPanel — 来电/通话/错误浮层。phase==='idle' 时不渲染。
 * props: state, localStream, remoteStream, muted, cameraOff,
 *        accept, reject, hangup, dismiss, toggleMute, toggleCamera, nameOf(id)->string
 */
export function VideoCallPanel({ state, localStream, remoteStream, muted, cameraOff, accept, reject, hangup, dismiss, toggleMute, toggleCamera, nameOf }) {
  if (!state || state.phase === 'idle') return null;
  const name = nameOf ? nameOf(state.peerId) : `#${state.peerId}`;

  if (state.phase === 'error') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-white rounded-lg p-6 text-center space-y-4 max-w-sm">
          <p className="text-red-600">{state.error || '通话失败'}</p>
          <button type="button" onClick={dismiss} className="px-4 py-2 rounded bg-zinc-700 text-white">关闭</button>
        </div>
      </div>
    );
  }

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
        {state.phase === 'calling' && <p className="absolute top-6 inset-x-0 text-center text-white">正在呼叫 {name}…</p>}
        {state.phase === 'connecting' && <p className="absolute top-6 inset-x-0 text-center text-white">连接中…</p>}
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
