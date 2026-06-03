import { describe, expect, it } from 'vitest';
import { webrtcReducer, initialCallState } from '../webrtcReducer.js';

const s0 = initialCallState;

describe('webrtcReducer', () => {
  it('admin START_CALL -> calling', () => {
    const s = webrtcReducer(s0, { type: 'START_CALL', peerId: 2, peerName: 'bob' });
    expect(s.phase).toBe('calling'); expect(s.peerId).toBe(2); expect(s.peerName).toBe('bob');
  });
  it('START_CALL ignored when not idle', () => {
    const busy = { ...s0, phase: 'connected', peerId: 2 };
    expect(webrtcReducer(busy, { type: 'START_CALL', peerId: 3 })).toBe(busy);
  });
  it('INCOMING_OFFER -> ringing', () => {
    const s = webrtcReducer(s0, { type: 'INCOMING_OFFER', peerId: 1, peerName: 'alice' });
    expect(s.phase).toBe('ringing'); expect(s.peerId).toBe(1);
  });
  it('INCOMING_OFFER ignored while busy (keeps current call)', () => {
    const live = { ...s0, phase: 'connected', peerId: 2 };
    const s = webrtcReducer(live, { type: 'INCOMING_OFFER', peerId: 3 });
    expect(s.phase).toBe('connected'); expect(s.peerId).toBe(2);
  });
  it('ACCEPT (ringing) -> connecting', () => {
    const r = webrtcReducer(s0, { type: 'INCOMING_OFFER', peerId: 1 });
    expect(webrtcReducer(r, { type: 'ACCEPT' }).phase).toBe('connecting');
  });
  it('ANSWERED (calling) -> connecting', () => {
    const c = webrtcReducer(s0, { type: 'START_CALL', peerId: 2 });
    expect(webrtcReducer(c, { type: 'ANSWERED' }).phase).toBe('connecting');
  });

  // MUST-FIX #1: CONNECTED authoritative from ANY live phase (ICE can win before ANSWERED commits)
  it('CONNECTED works directly from calling (ANSWERED never dispatched)', () => {
    const c = webrtcReducer(s0, { type: 'START_CALL', peerId: 2 });
    expect(webrtcReducer(c, { type: 'CONNECTED' }).phase).toBe('connected');
  });
  it('CONNECTED works from ringing and connecting', () => {
    const r = webrtcReducer(s0, { type: 'INCOMING_OFFER', peerId: 1 });
    expect(webrtcReducer(r, { type: 'CONNECTED' }).phase).toBe('connected');
    expect(webrtcReducer({ ...s0, phase: 'connecting', peerId: 2 }, { type: 'CONNECTED' }).phase).toBe('connected');
  });
  it('CONNECTED is a no-op from idle / already-connected / error', () => {
    expect(webrtcReducer(s0, { type: 'CONNECTED' }).phase).toBe('idle');
    const conn = { ...s0, phase: 'connected', peerId: 2 };
    expect(webrtcReducer(conn, { type: 'CONNECTED' })).toBe(conn);
    const err = { ...s0, phase: 'error', error: 'x' };
    expect(webrtcReducer(err, { type: 'CONNECTED' })).toBe(err);
  });

  // MUST-FIX (should-fix #4): ERROR has its own phase so the UI can show it
  it('ERROR -> error phase with message (not idle)', () => {
    const live = { ...s0, phase: 'calling', peerId: 2 };
    const s = webrtcReducer(live, { type: 'ERROR', error: '需要授权摄像头' });
    expect(s.phase).toBe('error'); expect(s.error).toBe('需要授权摄像头');
  });
  it('DISMISS -> idle', () => {
    const err = { ...s0, phase: 'error', error: 'x' };
    expect(webrtcReducer(err, { type: 'DISMISS' }).phase).toBe('idle');
  });
  it('HANGUP / REMOTE_HANGUP / REJECT -> idle reset', () => {
    const live = { ...s0, phase: 'connected', peerId: 2, peerName: 'b' };
    for (const t of ['HANGUP', 'REMOTE_HANGUP', 'REJECT']) {
      const s = webrtcReducer(live, { type: t });
      expect(s.phase).toBe('idle'); expect(s.peerId).toBeNull();
    }
  });
});
