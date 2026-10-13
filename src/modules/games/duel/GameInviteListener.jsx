import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Swords } from 'lucide-react';
import { useShell } from '../../../shell/ShellContext';
import { ROUTES } from '../../../shell/paths';
import { useChatSocket } from '../../../hooks/useChatSocket';
import { friendService } from '../../../services/friendService';
import { haptic } from '../shared/haptics';
import './inviteToast.css';

const GAME_META = {
  gomoku: { name: '五子棋', path: ROUTES.GAMES_GOMOKU },
  banqi: { name: '翻翻棋', path: ROUTES.GAMES_BANQI },
};
// 这两个页面自己有完整的大厅（含邀请列表），不重复弹
const DUEL_PAGES = new Set([ROUTES.GAMES_GOMOKU, ROUTES.GAMES_BANQI]);

function isListeningPath(path) {
  if (DUEL_PAGES.has(path)) return false;
  return path === ROUTES.HOME || path === ROUTES.CHAT || path === ROUTES.GAMES || path.startsWith(`${ROUTES.GAMES}/`);
}

function Countdown({ until }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="gi-count">{Math.max(0, Math.ceil((until - Date.now()) / 1000))}s</span>;
}

/**
 * 全站约战邀请：在首页 / 小游戏 / 聊天（好友）页登录状态下保持 WS 连接，
 * 好友发来的五子棋 / 翻翻棋邀请以通知卡片弹出，接受后直接进入对局页。
 */
export default function GameInviteListener() {
  const { user, currentPath, navigate, api: shellApi } = useShell();
  const api = useMemo(() => shellApi('cf-workers'), [shellApi]);
  const active = !!user && isListeningPath(currentPath);
  const { status, sendSignal, subscribe } = useChatSocket(active);
  const [invites, setInvites] = useState([]);
  const [names, setNames] = useState({});
  const acceptingRef = useRef(null); // { inviteId, game, timer }
  const meRef = useRef(null);
  meRef.current = user ? Number(user.id) : null;

  useEffect(() => {
    if (!active) { setInvites([]); return; }
    friendService.listFriends(api)
      .then((d) => setNames(Object.fromEntries((d.friends || []).map((f) => [Number(f.id), f.username]))))
      .catch(() => {});
  }, [active, api]);

  useEffect(() => {
    if (status === 'open') sendSignal({ type: 'game:sync' });
  }, [status, sendSignal]);

  const goToGame = useCallback((game) => {
    const a = acceptingRef.current;
    if (a) clearTimeout(a.timer);
    acceptingRef.current = null;
    navigate(GAME_META[game].path);
  }, [navigate]);

  useEffect(() => subscribe((msg) => {
    switch (msg.type) {
      case 'game:sync':
        setInvites((msg.invites || []).filter((i) => i.to === meRef.current && GAME_META[i.game]));
        break;
      case 'game:invited':
        if (!GAME_META[msg.invite.game]) break;
        setInvites((l) => [...l.filter((i) => i.id !== msg.invite.id), msg.invite]);
        haptic('medium');
        break;
      case 'game:invite-closed':
        setInvites((l) => l.filter((i) => i.id !== msg.inviteId));
        break;
      case 'game:room':
        // 接受后服务端开局 → 进入对局页（对局页会自己 sync 到这个房间）
        if (acceptingRef.current) goToGame(msg.room.game);
        break;
      default:
        break;
    }
  }), [subscribe, goToGame]);

  if (!active || !invites.length) return null;

  const respond = (inv, accept) => {
    haptic();
    sendSignal({ type: 'game:respond', inviteId: inv.id, accept });
    setInvites((l) => l.filter((i) => i.id !== inv.id));
    if (accept) {
      // 正常情况下马上收到 game:room；兜底 2.5s 后直接跳过去由对局页同步
      acceptingRef.current = { inviteId: inv.id, timer: setTimeout(() => goToGame(inv.game), 2500) };
    }
  };

  return (
    <div className="gi-stack" role="region" aria-label="对战邀请">
      {invites.map((inv) => (
        <div key={inv.id} className="gi-card" role="alertdialog">
          <span className="gi-icon"><Swords size={18} /></span>
          <div className="gi-text">
            <b>{names[inv.from] ?? `#${inv.from}`}</b> 邀请你下{GAME_META[inv.game].name}
            <Countdown until={inv.expiresAt} />
          </div>
          <button type="button" className="gi-btn" onClick={() => respond(inv, false)}>拒绝</button>
          <button type="button" className="gi-btn is-primary" onClick={() => respond(inv, true)}>接受</button>
        </div>
      ))}
    </div>
  );
}
