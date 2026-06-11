import { useState } from 'react';
import { sortLocalRecords } from '../localBoard';

const MEDALS = ['🥇', '🥈', '🥉'];
const rankLabel = (i) => MEDALS[i] ?? i + 1;

/**
 * 双榜：全网榜（D1 聚合）+ 本地家族榜（localStorage，原版语义）。
 * global: undefined=加载中 / null=加载失败 / {players, recent}
 */
export function Leaderboard({ global, localRecords, isLoggedIn, onLogin, onClearLocal, onRetry }) {
  const [tab, setTab] = useState('global');

  return (
    <div>
      <div className="lb-tabs">
        <button type="button" className={`lb-tab ${tab === 'global' ? 'active' : ''}`} onClick={() => setTab('global')}>
          🌐 全网榜
        </button>
        <button type="button" className={`lb-tab ${tab === 'local' ? 'active' : ''}`} onClick={() => setTab('local')}>
          🏠 本地家族榜
        </button>
      </div>

      {tab === 'global' ? (
        <GlobalBoard global={global} isLoggedIn={isLoggedIn} onLogin={onLogin} onRetry={onRetry} />
      ) : (
        <LocalBoard records={localRecords} onClearLocal={onClearLocal} />
      )}
    </div>
  );
}

function GlobalBoard({ global, isLoggedIn, onLogin, onRetry }) {
  if (global === undefined) {
    return <p className="lb-empty">榜单加载中……</p>;
  }
  if (global === null) {
    return (
      <div>
        <p className="lb-empty">全网榜暂时联系不上裁判台。</p>
        {onRetry && (
          <div className="lb-actions">
            <button type="button" className="btn ghost" onClick={onRetry}>重试</button>
          </div>
        )}
      </div>
    );
  }

  const { players = [], recent = [] } = global;

  return (
    <div>
      {players.length === 0 ? (
        <p className="lb-empty">全网还没有战绩 —— 第一个上榜的人，就是第一个传说。</p>
      ) : (
        <table className="lb-table">
          <thead>
            <tr><th>#</th><th>选手</th><th>胜 / 场</th><th>胜率</th><th>最快反应</th><th>荣誉</th></tr>
          </thead>
          <tbody>
            {players.map((p, i) => (
              <tr key={p.username} className={i === 0 ? 'top' : ''}>
                <td className="mono">{rankLabel(i)}</td>
                <td>{p.lastFace} <b>{p.username}</b>（{p.lastCharacter}）</td>
                <td className="mono">{p.wins} / {p.games}</td>
                <td className="mono">{p.winRate}%</td>
                <td className="mono">{p.bestMs != null ? `${p.bestMs}ms` : '—'}</td>
                <td className="mono">
                  {p.championships > 0 && `👑×${p.championships} `}
                  {p.adventureClears > 0 && `🗺️×${p.adventureClears}`}
                  {!p.championships && !p.adventureClears && '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {recent.length > 0 && (
        <table className="lb-table">
          <thead>
            <tr><th>最近战报</th><th>反应</th><th>时间</th></tr>
          </thead>
          <tbody>
            {recent.map((m, i) => (
              <tr key={`${m.username}-${m.createdAt}-${i}`}>
                <td>
                  {m.face} <b>{m.username}</b> {m.setsWon}-{m.setsLost} {m.setsWon > m.setsLost ? '胜' : '负'} {m.opponentFace} {m.opponent}
                </td>
                <td className="mono">{m.reactionMs != null ? `${m.reactionMs}ms·${m.grade}级` : '—'}</td>
                <td className="mono">{(m.createdAt || '').slice(5, 16)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!isLoggedIn && (
        <div className="lb-actions">
          <span className="lb-empty">游客成绩只记在本机 —— 登录后自动上全网榜。</span>
          <button type="button" className="btn ghost" onClick={onLogin}>登录上榜 →</button>
        </div>
      )}
    </div>
  );
}

function LocalBoard({ records, onClearLocal }) {
  if (!records.length) {
    return <p className="lb-empty">本机还没有战绩 —— 第一个上场的人，就是第一个传说。</p>;
  }
  const sorted = sortLocalRecords(records);
  return (
    <div>
      <table className="lb-table">
        <thead>
          <tr><th>#</th><th>战绩</th><th>反应</th><th>时间</th></tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={`${r.p}-${r.d}-${i}`} className={i === 0 ? 'top' : ''}>
              <td className="mono">{rankLabel(i)}</td>
              <td>{r.pf} <b>{r.p}</b> {r.sp}-{r.so} {r.sp > r.so ? '胜' : '负'} {r.of} {r.o}</td>
              <td className="mono">{r.ms}ms·{r.g}级</td>
              <td className="mono">{r.d}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {onClearLocal && (
        <div className="lb-actions">
          <button type="button" className="btn ghost" onClick={onClearLocal}>清空本地榜（慎点）</button>
        </div>
      )}
    </div>
  );
}
