import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VideoCallPanel } from '../components/VideoCallPanel.jsx';

const noop = () => {};
const base = {
  localStream: null, remoteStream: null, muted: false, cameraOff: false,
  accept: noop, reject: noop, hangup: noop, dismiss: noop, toggleMute: noop, toggleCamera: noop,
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
  it('shows calling state', () => {
    const html = renderToStaticMarkup(<VideoCallPanel state={{ phase: 'calling', peerId: 1 }} {...base} />);
    expect(html).toContain('呼叫');
  });
  it('shows hangup + mute controls when connected', () => {
    const html = renderToStaticMarkup(<VideoCallPanel state={{ phase: 'connected', peerId: 1 }} {...base} />);
    expect(html).toContain('挂断'); expect(html).toContain('静音');
  });
  it('shows the error message + dismiss when phase=error', () => {
    const html = renderToStaticMarkup(<VideoCallPanel state={{ phase: 'error', error: '需要授权摄像头/麦克风' }} {...base} />);
    expect(html).toContain('需要授权摄像头/麦克风'); expect(html).toContain('关闭');
  });
});
