import React, { useEffect, useRef, useState } from 'react';
import { DraggablePiP } from './DraggablePiP';

function Stream({ tag: Tag = 'video', stream, muted, className }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream || null; }, [stream]);
  return <Tag ref={ref} autoPlay playsInline muted={muted} className={className} />;
}

const RES_OPTIONS = ['1080p', '720p'];

/**
 * VideoCallPanel — 会议布局 + 屏幕共享。phase==='idle' 不渲染。
 * 主视图：对方共享 > 我共享 > 对方摄像头；摄像头为可拖动/缩放的画中画。
 * 远端音频用独立常驻 <audio> 承载，所有 video 静音（防布局切换断音/重音）。
 */
export function VideoCallPanel(props) {
  const {
    state, localStream, remoteCameraStream, remoteScreenStream, remoteAudioStream, localScreenStream,
    sharingScreen, remoteSharing, screenShareReady, muted, cameraOff,
    accept, reject, hangup, dismiss, toggleMute, toggleCamera,
    startScreenShare, stopScreenShare, applyShareResolution, canScreenShare, nameOf,
  } = props;
  const showShare = canScreenShare && screenShareReady;   // 仅当本端真有屏幕发送轨时才显示

  const panelRef = useRef(null);
  const [controlsHidden, setControlsHidden] = useState(false);
  const [cameraMinimized, setCameraMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [shareRes, setShareRes] = useState('1080p');

  useEffect(() => {
    const onFs = () => setIsFullscreen(typeof document !== 'undefined' && !!document.fullscreenElement);
    if (typeof document !== 'undefined') document.addEventListener('fullscreenchange', onFs);
    return () => { if (typeof document !== 'undefined') document.removeEventListener('fullscreenchange', onFs); };
  }, []);

  const toggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else panelRef.current?.requestFullscreen?.();
  };
  const onResChange = (v) => { setShareRes(v); if (sharingScreen) applyShareResolution?.(v); };

  if (!state || state.phase === 'idle') return null;
  const name = nameOf ? nameOf(state.peerId) : `#${state.peerId}`;

  if (state.phase === 'error') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
        <div className="bg-white rounded-lg p-6 text-center space-y-4 max-w-sm">
          <p className="text-red-600">{state.error || '通话失败'}</p>
          <button type="button" onClick={dismiss} className="px-4 py-2 rounded bg-zinc-700 text-white">关闭</button>
        </div>
      </div>
    );
  }

  if (state.phase === 'ringing') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
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

  // calling / connecting / connected
  const screenStream = remoteSharing ? remoteScreenStream : (sharingScreen ? localScreenStream : null);
  const mainStream = screenStream || remoteCameraStream;
  const btn = 'px-3 py-2 rounded bg-zinc-700 text-white text-sm';

  return (
    <div ref={panelRef} className="fixed inset-0 z-[100] flex flex-col bg-black overflow-hidden">
      <div className="relative flex-1 min-h-0">
        <Stream stream={mainStream} muted className="absolute inset-0 w-full h-full object-contain" />

        {/* 远端音频：独立常驻，整通话不随布局变动 */}
        <Stream tag="audio" stream={remoteAudioStream} muted={false} className="hidden" />

        {/* 屏幕做主视图时，对端摄像头作小窗（固定左上） */}
        {screenStream && !cameraMinimized && remoteCameraStream && (
          <Stream stream={remoteCameraStream} muted className="absolute top-4 left-4 w-28 sm:w-44 rounded border border-white/30 shadow-lg bg-black" />
        )}
        {/* 我在共享但对方也共享(对方占主视图)时，本地屏幕也给个小窗，便于自查 */}
        {sharingScreen && remoteSharing && (
          <Stream stream={localScreenStream} muted className="absolute top-4 left-36 sm:left-52 w-28 sm:w-44 rounded border border-amber-400/60 shadow-lg bg-black" />
        )}
        {/* 本地摄像头：可拖动/缩放画中画 */}
        {!cameraMinimized && (
          <DraggablePiP>
            <Stream stream={localStream} muted className="w-full h-full object-cover rounded bg-black" />
          </DraggablePiP>
        )}

        {remoteSharing && <p className="absolute top-2 inset-x-0 text-center text-white/80 text-sm">{name} 正在共享屏幕</p>}
        {sharingScreen && <p className="absolute top-8 inset-x-0 text-center text-amber-300/90 text-sm">你正在共享屏幕</p>}
        {state.phase === 'calling' && <p className="absolute top-16 inset-x-0 text-center text-white">正在呼叫 {name}…</p>}
        {state.phase === 'connecting' && <p className="absolute top-16 inset-x-0 text-center text-white">连接中…</p>}

        {controlsHidden && (
          <button type="button" onClick={() => setControlsHidden(false)} className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/20 text-white text-xs">显示控制</button>
        )}
      </div>

      {!controlsHidden && (
        <div className="shrink-0 flex flex-wrap gap-2 justify-center items-center p-3 bg-zinc-900">
          <button type="button" onClick={toggleMute} className={btn}>{muted ? '取消静音' : '静音'}</button>
          <button type="button" onClick={toggleCamera} className={btn}>{cameraOff ? '开摄像头' : '关摄像头'}</button>
          {showShare && (
            <>
              <button type="button" onClick={sharingScreen ? stopScreenShare : () => startScreenShare(shareRes)} className={btn}>
                {sharingScreen ? '停止共享' : '共享屏幕'}
              </button>
              <select
                value={shareRes}
                onChange={(e) => onResChange(e.target.value)}
                className="px-2 py-2 rounded bg-zinc-700 text-white text-sm"
                title="共享清晰度"
              >
                {RES_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </>
          )}
          <button type="button" onClick={() => setCameraMinimized((v) => !v)} className={btn}>{cameraMinimized ? '显示摄像头' : '最小化摄像头'}</button>
          <button type="button" onClick={() => setControlsHidden(true)} className={btn}>隐藏栏</button>
          <button type="button" onClick={toggleFullscreen} className={btn}>{isFullscreen ? '退出全屏' : '全屏'}</button>
          <button type="button" onClick={hangup} className="px-4 py-2 rounded bg-red-600 text-white text-sm">挂断</button>
        </div>
      )}
    </div>
  );
}

export default VideoCallPanel;
