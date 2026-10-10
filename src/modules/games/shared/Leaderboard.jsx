import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Trophy } from 'lucide-react';
import { getMinigameLeaderboard } from '../../../services/minigamesService';

export function formatMs(ms) {
  if (ms == null) return '--';
  const total = Math.floor(ms / 100) / 10;
  const m = Math.floor(total / 60);
  const s = (total % 60).toFixed(1).padStart(4, '0');
  return m ? `${m}:${s}` : `${s}s`;
}

/**
 * 全网排行榜面板。refreshKey 变化时重新拉取（例如刚提交完成绩）。
 */
export default function Leaderboard({ game, variant, title, refreshKey, user, onLogin }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getMinigameLeaderboard(game, variant);
    setFailed(!res);
    setData(res);
    setLoading(false);
  }, [game, variant]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const players = data?.players ?? [];

  return (
    <div className="mac-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Trophy size={15} style={{ color: 'var(--warning)' }} />
          {title}
        </div>
        <button type="button" onClick={load} className="text-ink-muted hover:text-ink" aria-label="刷新排行榜">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {user ? (
        data?.me ? (
          <div className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--accent-soft)' }}>
            我的最佳 <b className="font-mono">{formatMs(data.me.best)}</b> · 第 <b>{data.me.rank}</b> 名 · 共 {data.me.plays} 局
          </div>
        ) : (
          <div className="mb-3 text-xs text-ink-muted">通关后成绩自动上榜。</div>
        )
      ) : (
        <div className="mb-3 text-xs text-ink-muted">
          游客可以玩，成绩不上榜。
          {onLogin && (
            <button type="button" onClick={onLogin} className="ml-1 underline hover:text-ink">登录 / 注册</button>
          )}
        </div>
      )}

      {failed ? (
        <div className="py-6 text-center text-xs text-ink-muted">排行榜加载失败</div>
      ) : !loading && players.length === 0 ? (
        <div className="py-6 text-center text-xs text-ink-muted">还没有人上榜，来当第一个吧</div>
      ) : (
        <ol className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
          {players.map((p, i) => {
            const mine = user && p.username === user.username;
            return (
              <li
                key={p.username}
                className="flex items-center justify-between rounded-md px-2 py-1 text-sm"
                style={mine ? { background: 'var(--accent-soft)' } : undefined}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-6 text-right font-mono text-xs text-ink-muted">
                    {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                  </span>
                  <span className="truncate text-ink">{p.username}</span>
                </span>
                <span className="font-mono text-xs text-ink">{formatMs(p.best)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
