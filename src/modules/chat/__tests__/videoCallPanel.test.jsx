import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VideoCallPanel } from '../components/VideoCallPanel.jsx';

const noop = () => {};
const base = {
  localStream: null, remoteCameraStream: null, remoteScreenStream: null, remoteAudioStream: null, localScreenStream: null,
  sharingScreen: false, remoteSharing: false, screenShareReady: true, muted: false, cameraOff: false,
  accept: noop, reject: noop, hangup: noop, dismiss: noop, toggleMute: noop, toggleCamera: noop,
  startScreenShare: noop, stopScreenShare: noop, applyShareResolution: noop, canScreenShare: true,
  nameOf: () => 'alice',
};

describe('VideoCallPanel', () => {
  it('renders nothing when idle', () => {
    expect(renderToStaticMarkup(<VideoCallPanel state={{ phase: 'idle' }} {...base} />)).toBe('');
  });
  it('shows incoming-call controls when ringing', () => {
    const html = renderToStaticMarkup(<VideoCallPanel state={{ phase: 'ringing', peerId: 1 }} {...base} />);
    expect(html).toContain('接听'); expect(html).toContain('拒绝'); expect(html).toContain('alice');
  });
  it('shows the error message + dismiss when phase=error', () => {
    const html = renderToStaticMarkup(<VideoCallPanel state={{ phase: 'error', error: '需要授权摄像头/麦克风' }} {...base} />);
    expect(html).toContain('需要授权摄像头/麦克风'); expect(html).toContain('关闭');
  });
  it('shows full control set when connected (desktop)', () => {
    const html = renderToStaticMarkup(<VideoCallPanel state={{ phase: 'connected', peerId: 1 }} {...base} />);
    expect(html).toContain('挂断');
    expect(html).toContain('静音');
    expect(html).toContain('共享屏幕');
    expect(html).toContain('最小化摄像头');
    expect(html).toContain('隐藏栏');
    expect(html).toContain('全屏');
  });
  it('hides screen-share controls when canScreenShare=false (mobile)', () => {
    const html = renderToStaticMarkup(<VideoCallPanel state={{ phase: 'connected', peerId: 1 }} {...base} canScreenShare={false} />);
    expect(html).not.toContain('共享屏幕');
  });
  it('hides screen-share controls when peer lacks screen transceiver (screenShareReady=false)', () => {
    const html = renderToStaticMarkup(<VideoCallPanel state={{ phase: 'connected', peerId: 1 }} {...base} screenShareReady={false} />);
    expect(html).not.toContain('共享屏幕');
  });
  it('shows the share-resolution selector with 1080p option', () => {
    const html = renderToStaticMarkup(<VideoCallPanel state={{ phase: 'connected', peerId: 1 }} {...base} />);
    expect(html).toContain('1080p');
    expect(html).toContain('720p');
  });
  it('shows "停止共享" + "你正在共享屏幕" banner when sharingScreen', () => {
    const html = renderToStaticMarkup(<VideoCallPanel state={{ phase: 'connected', peerId: 1 }} {...base} sharingScreen />);
    expect(html).toContain('停止共享');
    expect(html).toContain('你正在共享屏幕');
  });
});
