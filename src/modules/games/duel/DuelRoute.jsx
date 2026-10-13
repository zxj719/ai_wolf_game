import { useEffect, useState } from 'react';
import { BookOpen, Flag, LogOut, MessageCircle, RefreshCw, Swords, Users } from 'lucide-react';
import { useShell } from '../../../shell/ShellContext';
import { ROUTES } from '../../../shell/paths';
import GameStage, { DockButton } from '../shared/GameStage';
import { haptic } from '../shared/haptics';
import { useDuel } from './useDuel';
import './duel.css';

export const DUEL_GAMES = {
  gomoku: { name: '五子棋', path: ROUTES.GAMES_GOMOKU },
  banqi: { name: '翻翻棋', path: ROUTES.GAMES_BANQI },
  coopmines: { name: '双人扫雷', path: ROUTES.GAMES_COOPMINES },
};

const DIFF_LABEL = { beginner: '初级', intermediate: '中级', expert: '高级' };
/** 邀请里的游戏名（带难度等选项） */
export function inviteGameName(inv) {
  const base = DUEL_GAMES[inv.game]?.name ?? inv.game;
  const d = inv.options?.difficulty;
  return d && DIFF_LABEL[d] ? `${base}（${DIFF_LABEL[d]}）` : base;
}

const REASON_TEXT = {
  win: null,
  resign: '认输',
  disconnect: '掉线超时',
  draw: '和棋',
};

function Avatar({ name, online }) {
  return (
    <span className="du-avatar">
      {(name || '?').slice(0, 1).toUpperCase()}
      {online != null && <i className={online ? 'is-on' : ''} />}
    </span>
  );
}

function Countdown({ until }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="tnum">{Math.max(0, Math.ceil((until - Date.now()) / 1000))}s</span>;
}

/**
 * 好友约战页面骨架：未登录提示 / 大厅（好友 + 邀请）/ 对局。
 * 具体棋盘由 renderBoard({ room, duel, width, height }) 提供，
 * 状态文案由 describe(room) 提供 { turnText, myBadge, oppBadge }。
 */
export default function DuelRoute({ game, rules, renderBoard, describe, resultText, extras, lobbyTop, inviteOptions, resultOverride }) {
  const { navigate } = useShell();
  const duel = useDuel();
  const { user, room, friends, onlineFriends, incoming, outgoing, toast, status, serverReady } = duel;
  const meta = DUEL_GAMES[game];
  const [hiddenResult, setHiddenResult] = useState(null); // 收起结算卡片看终局的房间 id
  const [rulesOpen, setRulesOpen] = useState(false);

  // 接受了别的游戏的邀请 → 跳到对应页面
  useEffect(() => {
    if (room && room.game !== game) navigate(DUEL_GAMES[room.game].path);
  }, [room, game, navigate]);

  const inRoom = room && room.game === game;

  if (!user) {
    return (
      <GameStage title={meta.name}>
        {() => (
          <div className="du-center du-stack">
            {lobbyTop}
            <div className="du-card du-hero">
              <Swords size={36} />
              <h2>和好友一起玩{meta.name}</h2>
              <p>对战需要登录，并通过好友系统邀请对手。</p>
              <button type="button" className="gs-btn gs-btn-primary gs-press" onClick={() => navigate(ROUTES.LOGIN)}>登录 / 注册</button>
            </div>
          </div>
        )}
      </GameStage>
    );
  }

  // ---------------- 对局 ----------------
  if (inRoom) {
    const oppId = room.players[room.seat === 1 ? 1 : 0];
    const myTurn = room.status === 'playing' && room.state.turn === room.seat;
    const info = describe(room);
    const ext = extras ? extras(room, duel) : {};
    const iWon = room.result && room.result.winner === room.seat;
    const draw = room.result && room.result.winner === 0;
    const ov = room.result && resultOverride ? resultOverride(room, duel) : null;
    const iAskedRematch = room.rematch?.includes(Number(user.id));
    const oppAskedRematch = room.rematch?.includes(oppId);

    let message = toast ?? ext.message ?? null;
    if (!message && room.status === 'playing' && !room.opponentOnline) message = { text: '对手掉线了 · 60 秒内未回来判你胜', tone: 'warn' };
    if (!message && room.status === 'over' && oppAskedRematch && !iAskedRematch) message = { text: `${duel.nameOf(oppId)} 想再来一局` };

    return (
      <GameStage
        title={meta.name}
        controls={(
          <div className="du-players">
            <div className={`du-chip${room.status === 'playing' && room.state.turn === room.seat ? ' is-turn' : ''}`}>
              <Avatar name={duel.nameOf(user.id)} />
              <span className="du-chip-name">我</span>
              {info.myBadge}
            </div>
            <div className="du-turn">{room.status === 'playing' ? info.turnText(myTurn) : '对局结束'}</div>
            <div className={`du-chip${room.status === 'playing' && room.state.turn !== room.seat ? ' is-turn' : ''}`}>
              <Avatar name={duel.nameOf(oppId)} online={room.opponentOnline} />
              <span className="du-chip-name">{duel.nameOf(oppId)}</span>
              {info.oppBadge}
            </div>
          </div>
        )}
        message={message}
        dock={room.status === 'playing' ? (
          <>
            {ext.dock}
            <DockButton icon={BookOpen} label="规则" onClick={() => setRulesOpen(true)} />
            <DockButton icon={Flag} label="认输" onClick={() => { if (window.confirm('确定认输吗？')) duel.resign(); }} />
          </>
        ) : (
          <>
            <DockButton icon={BookOpen} label="规则" onClick={() => setRulesOpen(true)} />
            <DockButton icon={RefreshCw} label={iAskedRematch ? '等待对方' : oppAskedRematch ? '接受再来一局' : '再来一局'} on={iAskedRematch || oppAskedRematch} disabled={iAskedRematch} onClick={duel.rematch} />
            <DockButton icon={LogOut} label="离开" onClick={duel.leave} />
          </>
        )}
        sheet={{ open: rulesOpen, onClose: () => setRulesOpen(false), title: `${meta.name}规则`, content: <div className="du-card du-rules">{rules}</div> }}
        overlay={room.status === 'playing' ? ext.banner : room.status === 'over' && hiddenResult !== room.id && (
          <div className="gs-dialog-wrap du-result-wrap">
            <div className="gs-dialog" role="dialog">
              <div className="gs-dialog-emoji">{ov?.emoji ?? (draw ? '🤝' : iWon ? '🏆' : '🌧️')}</div>
              <h3>{ov?.title ?? (draw ? '和棋' : iWon ? '你赢了' : '你输了')}</h3>
              <p>
                {ov ? ov.detail : (
                  <>
                    {resultText?.(room) ?? ''}
                    {room.result.reason !== 'win' && REASON_TEXT[room.result.reason]
                      ? `${iWon ? '对方' : '你'}${REASON_TEXT[room.result.reason]}` : ''}
                  </>
                )}
              </p>
              <p>{oppAskedRematch ? `${duel.nameOf(oppId)} 想再来一局` : ''}</p>
              <div className="gs-dialog-actions">
                <button type="button" className="gs-btn gs-btn-primary gs-press" disabled={iAskedRematch} onClick={() => { haptic(); duel.rematch(); }}>
                  {iAskedRematch ? '等待对方…' : oppAskedRematch ? '接受再来一局' : '再来一局'}
                </button>
                <button type="button" className="gs-btn gs-btn-tinted gs-press" onClick={() => { haptic(); setHiddenResult(room.id); }}>查看棋盘</button>
                <button type="button" className="gs-btn gs-btn-tinted gs-press" onClick={() => { haptic(); duel.leave(); }}>返回大厅</button>
              </div>
            </div>
          </div>
        )}
      >
        {(size) => renderBoard({ room, duel, ...size })}
      </GameStage>
    );
  }

  // ---------------- 大厅 ----------------
  const sorted = [...friends].sort((a, b) => Number(onlineFriends.has(b.id)) - Number(onlineFriends.has(a.id)));
  const pendingTo = new Set(outgoing.map((i) => i.to));

  return (
    <GameStage
      title={meta.name}
      scroll
      message={toast
        ?? (serverReady === false ? { text: '对战服务器升级中，暂时无法约战，稍后再来', tone: 'warn' }
          : status !== 'open' && status !== 'idle' ? { text: '正在连接对战服务器…' } : null)}
    >
      {() => (
        <div className="du-lobby">
          {lobbyTop}
          {incoming.length > 0 && (
            <section>
              <h3 className="du-section">对战邀请</h3>
              <div className="gs-group">
                {incoming.map((inv) => (
                  <div key={inv.id} className="gs-row du-invite">
                    <Avatar name={duel.nameOf(inv.from)} online />
                    <span className="gs-name"><b>{duel.nameOf(inv.from)}</b> 邀请你{inv.game === 'coopmines' ? '玩' : '下'}{inviteGameName(inv)}</span>
                    <span className="du-muted"><Countdown until={inv.expiresAt} /></span>
                    <button type="button" className="du-pill gs-press" onClick={() => { haptic(); duel.respond(inv.id, false); }}>拒绝</button>
                    <button type="button" className="du-pill is-primary gs-press" onClick={() => { haptic(); duel.respond(inv.id, true); }}>接受</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {outgoing.length > 0 && (
            <section>
              <h3 className="du-section">已发出</h3>
              <div className="gs-group">
                {outgoing.map((inv) => (
                  <div key={inv.id} className="gs-row">
                    <span className="du-spinner" />
                    <span className="gs-name">等待 <b>{duel.nameOf(inv.to)}</b> 回应 · {inviteGameName(inv)}</span>
                    <span className="du-muted"><Countdown until={inv.expiresAt} /></span>
                    <button type="button" className="du-pill gs-press" onClick={() => { haptic(); duel.cancelInvite(inv.id); }}>取消</button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="du-section">
              好友
              <button type="button" className="du-link gs-press" onClick={duel.reloadFriends}>刷新</button>
            </h3>
            {sorted.length === 0 ? (
              <div className="gs-group">
                <div className="gs-empty">
                  还没有好友 ·{' '}
                  <button type="button" className="gs-link" onClick={() => navigate(ROUTES.CHAT)}>去「聊天」添加好友</button>
                </div>
              </div>
            ) : (
              <div className="gs-group">
                {sorted.map((f) => {
                  const on = onlineFriends.has(f.id);
                  return (
                    <div key={f.id} className="gs-row">
                      <Avatar name={f.username} online={on} />
                      <span className="gs-name">{f.username}<small className="du-muted">{on ? ' · 在线' : ' · 离线'}</small></span>
                      <button
                        type="button"
                        className="du-pill is-primary gs-press"
                        disabled={!on || pendingTo.has(f.id) || status !== 'open' || serverReady === false}
                        onClick={() => { haptic(); duel.invite(f.id, game, inviteOptions); }}
                      >
                        <Swords size={14} /> 约战
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="du-foot">
              <Users size={13} /> 在线 = 好友此刻在首页、小游戏或聊天页。也可以先在
              <button type="button" className="gs-link" onClick={() => navigate(ROUTES.CHAT)}><MessageCircle size={13} /> 聊天</button>
              里叫上对方。
            </p>
          </section>

          <section>
            <h3 className="du-section">规则</h3>
            <div className="du-card du-rules">{rules}</div>
          </section>
        </div>
      )}
    </GameStage>
  );
}
