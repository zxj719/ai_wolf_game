import { useCallback, useEffect, useMemo, useState } from "react";
import { useShell } from "../../shell/ShellContext";
import { ROUTES } from "../../shell/paths";
import { friendService } from "../../services/friendService";
import { useChatSocket } from "../../hooks/useChatSocket";
import { useWebRTC } from "../../hooks/useWebRTC";
import { AddFriend } from "./components/AddFriend";
import { FriendRequests } from "./components/FriendRequests";
import { FriendList } from "./components/FriendList";
import { ConversationView } from "./components/ConversationView";
import { VideoCallPanel } from "./components/VideoCallPanel";
import {
  ArrowLeft,
  ArrowUpRight,
  Coffee,
  Loader2,
  MessageCircle,
  RefreshCw,
  UserPlus,
  Users,
} from "lucide-react";
import { Avatar } from "../../components/Personal/Avatar";
import { ProfileEditor } from "../../components/Personal/ProfileEditor";

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
  const api = useMemo(() => shellApi("cf-workers"), [shellApi]);
  const chat = useChatSocket(Boolean(user));
  const webrtc = useWebRTC({ chat, api });

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [requests, setRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("friends");
  const [showProfile, setShowProfile] = useState(false);

  const nameOf = useCallback(
    (id) => {
      const friend = friends.find((f) => Number(f.id) === Number(id));
      return friend?.displayName || friend?.username || `#${id}`;
    },
    [friends],
  );

  const refresh = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const [rq, fl] = await Promise.all([
        friendService.listRequests(api),
        friendService.listFriends(api),
      ]);
      setRequests(rq.requests || []);
      setFriends(fl.friends || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [api, user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onSearch = useCallback(async () => {
    if (query.trim().length < 2 || searching) return;
    setSearching(true);
    setError(null);
    setNotice("");
    try {
      const res = await friendService.searchUsers(api, query);
      setResults(res.results || []);
      setSearched(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  }, [api, query, searching]);

  const onSendRequest = useCallback(
    async (u) => {
      setPendingId(u.id);
      setError(null);
      try {
        const result = await friendService.sendRequest(api, u.id);
        setResults((prev) => prev.filter((r) => r.id !== u.id));
        setSearched(false);
        setNotice(
          result.status === "accepted" || result.status === "already_friends"
            ? "已经成为好友，去打个招呼吧。"
            : "好友申请已发送，期待新的相遇。",
        );
        await refresh();
      } catch (e) {
        setError(e.message);
      } finally {
        setPendingId(null);
      }
    },
    [api, refresh],
  );

  const onAccept = useCallback(
    async (r) => {
      setPendingId(r.id);
      try {
        await friendService.respond(api, r.id, "accept");
        await refresh();
      } catch (e) {
        setError(e.message);
      } finally {
        setPendingId(null);
      }
    },
    [api, refresh],
  );

  const onReject = useCallback(
    async (r) => {
      setPendingId(r.id);
      try {
        await friendService.respond(api, r.id, "reject");
        await refresh();
      } catch (e) {
        setError(e.message);
      } finally {
        setPendingId(null);
      }
    },
    [api, refresh],
  );

  if (!user) {
    return (
      <div className="friends-space">
        <div className="friends-container">
          <header className="friends-header">
            <button type="button" onClick={() => navigate(ROUTES.HOME)}>
              <ArrowLeft size={16} />
              回游乐场
            </button>
            <span className="studio-kicker">THE FRIENDS LOUNGE</span>
          </header>
          <div className="friends-guest">
            <div className="lounge-art" aria-hidden="true">
              <span>hello.</span>
              <Coffee size={52} strokeWidth={1} />
              <i>good company, good times.</i>
            </div>
            <span className="studio-kicker">PULL UP A CHAIR</span>
            <h1>有趣的事，和朋友一起。</h1>
            <p>
              一个聊天的角落，一场随时开始的游戏，
              <br />
              还有那些聊着聊着就冒出来的新想法。
            </p>
            <button
              type="button"
              onClick={() => navigate(ROUTES.LOGIN)}
              className="studio-button primary"
            >
              登录，来坐坐
              <ArrowUpRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => navigate(ROUTES.HOME)}
              className="guest-back"
            >
              先回游乐场逛逛
              <ArrowLeft size={14} />
            </button>
            <small>好友功能需要登录 · 其他内容可以继续自由探索</small>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="friends-space">
      <div className="friends-container">
        <header className="friends-header">
          <button type="button" onClick={() => navigate(ROUTES.HOME)}>
            <ArrowLeft size={16} />
            回游乐场
          </button>
          <span className="studio-kicker">THE FRIENDS LOUNGE</span>
          <button
            type="button"
            className="friends-me"
            onClick={() => setShowProfile(true)}
          >
            <Avatar
              name={user.displayName || user.username}
              color={user.avatarColor}
            />
            个人资料
          </button>
        </header>
        <div className="friends-title">
          <div>
            <span className="studio-kicker">A SPACE FOR GOOD COMPANY</span>
            <h1>
              好友客厅<span>✳</span>
            </h1>
            <p>聊聊天，约一局。好玩的事，和朋友一起。</p>
          </div>
          <span className="friends-connection">
            <i className={chat.status === "open" ? "connected" : ""} />
            {chat.status === "open" ? "实时连接已就绪" : "正在连接实时服务…"}
          </span>
        </div>
        {error && (
          <div className="studio-error" role="alert">
            {error}
            <button type="button" onClick={refresh}>
              <RefreshCw size={13} />
              重试
            </button>
          </div>
        )}
        {notice && (
          <p className="studio-success" role="status">
            {notice}
          </p>
        )}
        <div
          className={`friends-workspace ${selectedFriend ? "has-conversation" : ""}`}
        >
          <aside className="friends-sidebar">
            <div className="friends-tabs" role="group" aria-label="好友视图">
              <button
                type="button"
                aria-pressed={tab === "friends"}
                onClick={() => setTab("friends")}
              >
                <Users size={15} />
                好友<span>{friends.length}</span>
              </button>
              <button
                type="button"
                aria-pressed={tab === "discover"}
                onClick={() => setTab("discover")}
              >
                <UserPlus size={15} />
                发现与申请
                {requests.length > 0 && <span>{requests.length}</span>}
              </button>
            </div>
            {tab === "discover" ? (
              <div className="friends-discover">
                <h2>认识新朋友</h2>
                <p>搜索账号或显示名称，找到熟悉的人。</p>
                <AddFriend
                  query={query}
                  results={results}
                  onQueryChange={(value) => {
                    setQuery(value);
                    setSearched(false);
                  }}
                  onSearch={onSearch}
                  onSendRequest={onSendRequest}
                  searching={searching}
                  searched={searched}
                  pendingId={pendingId}
                />
                <FriendRequests
                  requests={requests}
                  onAccept={onAccept}
                  onReject={onReject}
                  pendingId={pendingId}
                />
                {!requests.length && (
                  <div className="requests-clear">
                    <span>✉</span>
                    <p>暂时没有新的好友申请</p>
                    <small>新的相遇，值得等待。</small>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="friend-list-heading">
                  <span>我的好友</span>
                  <button
                    type="button"
                    onClick={() => setTab("discover")}
                    aria-label="添加好友"
                  >
                    <UserPlus size={16} />
                  </button>
                </div>
                {loading ? (
                  <div className="friends-loading" role="status">
                    <Loader2 size={20} className="animate-spin" />
                    正在寻找朋友们…
                  </div>
                ) : (
                  <FriendList
                    friends={friends}
                    onSelect={setSelectedFriend}
                    selectedId={selectedFriend?.id}
                    onlineFriends={chat.onlineFriends}
                  />
                )}
                <div className="sidebar-note">
                  <Coffee size={16} />
                  <span>一个不赶时间的聊天角落。</span>
                </div>
              </>
            )}
          </aside>
          <section className="friends-conversation" aria-label="会话">
            {selectedFriend ? (
              <>
                <button
                  type="button"
                  className="conversation-back"
                  onClick={() => setSelectedFriend(null)}
                >
                  <ArrowLeft size={15} />
                  返回好友列表
                </button>
                <ConversationView
                  key={selectedFriend.id}
                  api={api}
                  meId={user.id}
                  friend={selectedFriend}
                  chat={chat}
                  onStartCall={() =>
                    webrtc.startCall(
                      selectedFriend.id,
                      selectedFriend.displayName || selectedFriend.username,
                    )
                  }
                />
              </>
            ) : (
              <div className="conversation-welcome">
                <div className="lounge-art" aria-hidden="true">
                  <span>hello.</span>
                  <Coffee size={52} strokeWidth={1} />
                  <i>good company, good times.</i>
                </div>
                <span className="studio-kicker">MAKE YOURSELF AT HOME</span>
                <h2>坐下来，聊点有趣的。</h2>
                <p>
                  选一位好友开始对话，
                  <br />
                  或者认识一个同样保持好奇的人。
                </p>
                <button
                  type="button"
                  className="studio-button"
                  onClick={() => setTab("discover")}
                >
                  <UserPlus size={16} />
                  发现新朋友
                </button>
                <div className="conversation-features">
                  <span>
                    <MessageCircle size={14} />
                    实时聊天
                  </span>
                  <span>↗ 视频通话</span>
                  <span>✣ 好友约战</span>
                </div>
              </div>
            )}
          </section>
        </div>
        <footer className="friends-footer">
          <span>GOOD COMPANY MAKES EVERYTHING BETTER.</span>
          <span>zhaxiaoji.com</span>
        </footer>
        {showProfile && <ProfileEditor onClose={() => setShowProfile(false)} />}
      </div>

      <VideoCallPanel
        state={webrtc.state}
        localStream={webrtc.localStream}
        remoteCameraStream={webrtc.remoteCameraStream}
        remoteScreenStream={webrtc.remoteScreenStream}
        remoteAudioStream={webrtc.remoteAudioStream}
        localScreenStream={webrtc.localScreenStream}
        sharingScreen={webrtc.sharingScreen}
        remoteSharing={webrtc.remoteSharing}
        screenShareReady={webrtc.screenShareReady}
        muted={webrtc.muted}
        cameraOff={webrtc.cameraOff}
        accept={webrtc.accept}
        reject={webrtc.reject}
        hangup={webrtc.hangup}
        dismiss={webrtc.dismiss}
        toggleMute={webrtc.toggleMute}
        toggleCamera={webrtc.toggleCamera}
        startScreenShare={webrtc.startScreenShare}
        stopScreenShare={webrtc.stopScreenShare}
        applyShareResolution={webrtc.applyShareResolution}
        canScreenShare={
          typeof navigator !== "undefined" &&
          !!navigator.mediaDevices?.getDisplayMedia
        }
        nameOf={nameOf}
      />
    </div>
  );
}
