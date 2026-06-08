import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShell } from '../../shell/ShellContext';
import { ROUTES } from '../../shell/paths';
import { friendService } from '../../services/friendService';
import { useAuth } from '../../contexts/AuthContext';
import { useChatSocket } from '../../hooks/useChatSocket';
import { useWebRTC } from '../../hooks/useWebRTC';
import { AddFriend } from './components/AddFriend';
import { FriendRequests } from './components/FriendRequests';
import { FriendList } from './components/FriendList';
import { ConversationView } from './components/ConversationView';
import { VideoCallPanel } from './components/VideoCallPanel';

/**
 * ChatRoute — 好友 + 私聊（Phase 2）。
 * 左侧好友/申请/搜索；选中好友后渲染实时会话窗。
 * 游客（无真实 user）看到登录引导。
 *
 * 认证：用 useShell().api('cf-workers') 拿到已注入 Authorization 的客户端；
 * 实时走 useChatSocket（直连 ECS WSS，token 经子协议传递）。
 */
export default function ChatRoute() {
  const { user, navigate, api: shellApi } = useShell();
  const { isAdmin } = useAuth();
  const api = useMemo(() => shellApi('cf-workers'), [shellApi]);
  const chat = useChatSocket(Boolean(user));
  const webrtc = useWebRTC({ chat, isAdmin });

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [requests, setRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [error, setError] = useState(null);

  const nameOf = useCallback(
    (id) => friends.find((f) => Number(f.id) === Number(id))?.username ?? `#${id}`,
    [friends]
  );

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const [rq, fl] = await Promise.all([
        friendService.listRequests(api),
        friendService.listFriends(api),
      ]);
      setRequests(rq.requests || []);
      setFriends(fl.friends || []);
    } catch (e) {
      setError(e.message);
    }
  }, [api, user]);

  useEffect(() => { refresh(); }, [refresh]);

  const onSearch = useCallback(async () => {
    try {
      const res = await friendService.searchUsers(api, query);
      setResults(res.results || []);
    } catch (e) { setError(e.message); }
  }, [api, query]);

  const onSendRequest = useCallback(async (u) => {
    try {
      await friendService.sendRequest(api, u.id);
      setResults((prev) => prev.filter((r) => r.id !== u.id));
      await refresh();
    } catch (e) { setError(e.message); }
  }, [api, refresh]);

  const onAccept = useCallback(async (r) => {
    try { await friendService.respond(api, r.id, 'accept'); await refresh(); }
    catch (e) { setError(e.message); }
  }, [api, refresh]);

  const onReject = useCallback(async (r) => {
    try { await friendService.respond(api, r.id, 'reject'); await refresh(); }
    catch (e) { setError(e.message); }
  }, [api, refresh]);

  if (!user) {
    return (
      <div className="mac-app-shell min-h-screen flex items-center justify-center bg-bg">
        <div className="text-center space-y-3">
          <p className="text-ink">好友功能需要登录</p>
          <button type="button" onClick={() => navigate(ROUTES.LOGIN)} className="px-4 py-2 rounded bg-accent hover:bg-accent-hover text-white">
            去登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mac-app-shell min-h-screen bg-bg text-ink">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">好友</h1>
          <button type="button" onClick={() => navigate(ROUTES.HOME)} className="text-sm text-ink-muted">返回</button>
        </header>

        {error && <p className="text-sm text-danger">{error}</p>}

        <AddFriend
          query={query} results={results}
          onQueryChange={setQuery} onSearch={onSearch} onSendRequest={onSendRequest}
        />
        <FriendRequests requests={requests} onAccept={onAccept} onReject={onReject} />
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-ink-muted">我的好友</h2>
          <FriendList friends={friends} onSelect={setSelectedFriend} />
        </section>

        {selectedFriend && (
          <ConversationView
            api={api} meId={user.id} friend={selectedFriend} chat={chat}
            onStartCall={() => webrtc.startCall(selectedFriend.id, selectedFriend.username)}
          />
        )}
      </div>

      <VideoCallPanel
        state={webrtc.state}
        localStream={webrtc.localStream}
        remoteCameraStream={webrtc.remoteCameraStream}
        remoteScreenStream={webrtc.remoteScreenStream}
        remoteAudioStream={webrtc.remoteAudioStream}
        localScreenStream={webrtc.localScreenStream}
        sharingScreen={webrtc.sharingScreen} remoteSharing={webrtc.remoteSharing}
        screenShareReady={webrtc.screenShareReady}
        muted={webrtc.muted} cameraOff={webrtc.cameraOff}
        accept={webrtc.accept} reject={webrtc.reject} hangup={webrtc.hangup} dismiss={webrtc.dismiss}
        toggleMute={webrtc.toggleMute} toggleCamera={webrtc.toggleCamera}
        startScreenShare={webrtc.startScreenShare} stopScreenShare={webrtc.stopScreenShare}
        applyShareResolution={webrtc.applyShareResolution}
        canScreenShare={typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia}
        nameOf={nameOf}
      />
    </div>
  );
}
