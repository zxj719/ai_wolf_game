import { useState } from 'react';
import { sortLocalRecords, computeWeeklyChamp, computeCounterEfficiency } from '../localBoard';
import { CHARS } from '../gameData';

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
  const [charFilter, setCharFilter] = useState(null);

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
  const filteredPlayers = charFilter ? players.filter((p) => p.lastCharacter === charFilter) : players;
  const filteredRecent = charFilter ? recent.filter((m) => m.character === charFilter) : recent;
  const activeChar = charFilter ? CHARS.find((c) => c.n === charFilter) : null;

  return (
    <div>
      <div className="lb-filter-chips">
        <button
          type="button"
          className={`lb-fc${!charFilter ? ' active' : ''}`}
          onClick={() => setCharFilter(null)}
        >
          全部
        </button>
        {CHARS.map((c) => (
          <button
            key={c.n}
            type="button"
            className={`lb-fc${charFilter === c.n ? ' active' : ''}`}
            onClick={() => setCharFilter(charFilter === c.n ? null : c.n)}
          >
            {c.f} {c.n}
          </button>
        ))}
      </div>

      {filteredPlayers.length === 0 ? (
        <p className="lb-empty">
          {charFilter
            ? `还没有以 ${activeChar?.f ?? ''} ${charFilter} 上榜的选手 —— 率先上场创造历史吧！`
            : '全网还没有战绩 —— 第一个上榜的人，就是第一个传说。'}
        </p>
      ) : (
        <table className="lb-table">
          <thead>
            <tr><th>#</th><th>选手</th><th>胜 / 场</th><th>胜率</th><th>最快反应</th><th>荣誉</th></tr>
          </thead>
          <tbody>
            {filteredPlayers.map((p, i) => (
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

      {filteredRecent.length > 0 && (
        <table className="lb-table">
          <thead>
            <tr><th>最近战报</th><th>反应</th><th>时间</th></tr>
          </thead>
          <tbody>
            {filteredRecent.map((m, i) => (
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
  const [charFilter, setCharFilter] = useState(null);

  const filteredRecords = charFilter ? records.filter((r) => r.p === charFilter) : records;
  const sorted = sortLocalRecords(filteredRecords);
  const activeChar = charFilter ? CHARS.find((c) => c.n === charFilter) : null;
  const weeklyChamp = computeWeeklyChamp(records);
  const counterBoard = computeCounterEfficiency(records);

  return (
    <div>
      {weeklyChamp && (
        <div className="weekly-champ-banner">
          🏅 本周家族最强：{weeklyChamp.face} <b>{weeklyChamp.name}</b> · 周内 {weeklyChamp.wins} 胜
        </div>
      )}
      <div className="lb-filter-chips">
        <button
          type="button"
          className={`lb-fc${!charFilter ? ' active' : ''}`}
          onClick={() => setCharFilter(null)}
        >
          全部
        </button>
        {CHARS.map((c) => (
          <button
            key={c.n}
            type="button"
            className={`lb-fc${charFilter === c.n ? ' active' : ''}`}
            onClick={() => setCharFilter(charFilter === c.n ? null : c.n)}
          >
            {c.f} {c.n}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <p className="lb-empty">
          {charFilter
            ? `还没有以 ${activeChar?.f ?? ''} ${charFilter} 出战的记录 —— 快来挑战吧！`
            : '本机还没有战绩 —— 第一个上场的人，就是第一个传说。'}
        </p>
      ) : (
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
      )}

      {counterBoard.length >= 2 && (
        <div className="lb-sub-board">
          <div className="lb-sub-title">🧩 读招王（克制命中率）</div>
          <table className="lb-table">
            <thead>
              <tr><th>#</th><th>选手</th><th>克制率</th><th>克制 / 总拍</th></tr>
            </thead>
            <tbody>
              {counterBoard.slice(0, 5).map((entry, i) => (
                <tr key={entry.name} className={i === 0 ? 'top' : ''}>
                  <td className="mono">{rankLabel(i)}</td>
                  <td>{entry.face} <b>{entry.name}</b></td>
                  <td className="mono">{entry.eff}%</td>
                  <td className="mono">{entry.cw} / {entry.tr}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="lb-sub-hint">仅统计 10 拍以上对局 · 克制得分 ÷ 总拍数</p>
        </div>
      )}

      {onClearLocal && (
        <div className="lb-actions">
          <button type="button" className="btn ghost" onClick={onClearLocal}>清空本地榜（慎点）</button>
        </div>
      )}
    </div>
  );
}
