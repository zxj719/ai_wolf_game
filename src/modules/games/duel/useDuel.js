import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShell } from '../../../shell/ShellContext';
import { useChatSocket } from '../../../hooks/useChatSocket';
import { friendService } from '../../../services/friendService';
import { haptic } from '../shared/haptics';

const CLOSE_REASONS = {
  declined: '对方拒绝了邀请',
  expired: '邀请已过期',
  offline: '对方已离线',
  busy: '对方正在对局中',
  cancelled: '邀请已取消',
};

/**
 * useDuel — 好友约战客户端状态。复用私聊的 ECS WebSocket（useChatSocket），
 * 所有判定以服务端推送的 room 为准，本地只做乐观的选择/高亮。
 */
export function useDuel() {
  const { user, api: shellApi } = useShell();
  const api = useMemo(() => shellApi('cf-workers'), [shellApi]);
  const socket = useChatSocket(Boolean(user));
  const { status, onlineFriends, reconnectNonce, sendSignal, subscribe } = socket;

  const [friends, setFriends] = useState([]);
  const [room, setRoom] = useState(null);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [toast, setToast] = useState(null);
  // 服务端是否支持约战：game:sync 有回音才算（前端先于 ECS 上线时不至于「点了没反应」）
  const [serverReady, setServerReady] = useState(null);
  const toastTimer = useRef(null);
  const meRef = useRef(null);
  meRef.current = user ? Number(user.id) : null;

  const say = useCallback((text, tone) => {
    clearTimeout(toastTimer.current);
    setToast({ text, tone, at: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const loadFriends = useCallback(async () => {
    if (!user) return;
    try {
      const data = await friendService.listFriends(api);
      setFriends((data.friends || []).map((f) => ({ id: Number(f.id), username: f.username })));
    } catch {
      setFriends([]);
    }
  }, [api, user]);
  useEffect(() => { loadFriends(); }, [loadFriends]);

  // 连上 / 重连后向服务端要一次当前对局与邀请
  useEffect(() => {
    if (status !== 'open') return undefined;
    sendSignal({ type: 'game:sync' });
    const t = setTimeout(() => setServerReady((v) => (v === true ? v : false)), 5000);
    return () => clearTimeout(t);
  }, [status, reconnectNonce, sendSignal]);

  useEffect(() => subscribe((msg) => {
    const me = meRef.current;
    switch (msg.type) {
      case 'game:sync':
        setServerReady(true);
        setRoom(msg.room);
        setIncoming((msg.invites || []).filter((i) => i.to === me));
        setOutgoing((msg.invites || []).filter((i) => i.from === me));
        break;
      case 'game:invited':
        setIncoming((l) => [...l.filter((i) => i.id !== msg.invite.id), msg.invite]);
        haptic('medium');
        break;
      case 'game:invite-sent':
        setOutgoing((l) => [...l.filter((i) => i.id !== msg.invite.id), msg.invite]);
        break;
      case 'game:invite-closed':
        setOutgoing((l) => {
          const mine = l.find((i) => i.id === msg.inviteId);
          if (mine && CLOSE_REASONS[msg.reason] && msg.reason !== 'cancelled') say(CLOSE_REASONS[msg.reason], 'warn');
          return l.filter((i) => i.id !== msg.inviteId);
        });
        setIncoming((l) => l.filter((i) => i.id !== msg.inviteId));
        break;
      case 'game:room':
        setRoom((prev) => {
          if (!prev || prev.id !== msg.room.id) haptic('success');
          return msg.room;
        });
        break;
      case 'game:closed':
        setRoom((prev) => (prev && prev.id === msg.roomId ? null : prev));
        break;
      case 'game:error':
        say(msg.error, 'bad');
        haptic('error');
        break;
      default:
        break;
    }
  }), [subscribe, say]);

  const send = useCallback((obj) => {
    if (!sendSignal(obj)) say('连接中断，正在重连…', 'warn');
  }, [sendSignal, say]);

  const roomId = room?.id;
  return {
    user,
    status,
    serverReady,
    friends,
    onlineFriends,
    room,
    incoming,
    outgoing,
    toast,
    reloadFriends: loadFriends,
    nameOf: (id) => (Number(id) === meRef.current ? (user?.username ?? '我') : friends.find((f) => f.id === Number(id))?.username ?? `#${id}`),
    invite: (to, game) => send({ type: 'game:invite', to, game }),
    cancelInvite: (inviteId) => send({ type: 'game:invite-cancel', inviteId }),
    respond: (inviteId, accept) => send({ type: 'game:respond', inviteId, accept }),
    act: (action) => send({ type: 'game:action', roomId, action }),
    resign: () => send({ type: 'game:resign', roomId }),
    rematch: () => send({ type: 'game:rematch', roomId }),
    leave: () => { send({ type: 'game:leave', roomId }); setRoom(null); },
  };
}
