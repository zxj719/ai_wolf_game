import { useCallback, useEffect, useState } from 'react';
import { getMinigameLeaderboard } from '../../../services/minigamesService';

export function formatMs(ms) {
  if (ms == null) return '--';
  const total = Math.floor(ms / 100) / 10;
  const m = Math.floor(total / 60);
  const s = (total % 60).toFixed(1).padStart(4, '0');
  return m ? `${m}:${s}` : `${s}s`;
}

/** 秒表显示：0:07 / 12:34（不带小数，HUD 用） */
export function formatClock(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * 全网排行榜（sheet 内容）。refreshKey 变化时重新拉取（例如刚提交完成绩）。
 */
export default function Leaderboard({ game, variant, refreshKey, user, onLogin }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setData(await getMinigameLeaderboard(game, variant));
    setLoading(false);
  }, [game, variant]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const players = data?.players ?? [];

  return (
    <div>
      <div className="gs-caption">
        {user ? (
          data?.me
            ? <>我的最佳 <b className="tnum">{formatMs(data.me.best)}</b> · 第 {data.me.rank} 名 · {data.me.plays} 局</>
            : '通关后成绩自动上榜'
        ) : (
          <>游客成绩不上榜 · <button type="button" className="gs-link" onClick={onLogin}>登录 / 注册</button></>
        )}
      </div>

      {loading && !data ? (
        <div className="gs-empty">加载中…</div>
      ) : !data ? (
        <div className="gs-empty">排行榜加载失败 · <button type="button" className="gs-link" onClick={load}>重试</button></div>
      ) : players.length === 0 ? (
        <div className="gs-empty">还没有人上榜，来当第一个吧</div>
      ) : (
        <div className="gs-group">
          {players.map((p, i) => (
            <div key={p.username} className={`gs-row${user && p.username === user.username ? ' is-me' : ''}`}>
              <span className={`gs-rank${i < 3 ? ' is-medal' : ''}`}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
              <span className="gs-name">{p.username}</span>
              <span className="gs-time">{formatMs(p.best)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
