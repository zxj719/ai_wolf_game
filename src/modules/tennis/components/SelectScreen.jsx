import { useState, useMemo } from 'react';
import { CHARS } from '../gameData';
import { Leaderboard } from './Leaderboard';
import { EQUIPMENT_SLOTS, SLOT_META, RARITY_META } from '../meta/equipment';
import { loadLocalRecords, computeCharStats, findBestChar } from '../localBoard';
import { getDailyChallenge, isDailyChallengeCompleted, loadDailyStats, computeDailyRank, DAILY_BONUS_COINS } from '../meta/dailyChallenge';

function getOppTag(name, map) {
  const data = map[name];
  if (!data || data.total === 0) return null;
  const rate = data.wins / data.total;
  if (rate >= 0.6) return { label: '推荐', cls: 'opp-tag-recommend' };
  if (rate < 0.35) return { label: '劲敌', cls: 'opp-tag-rival' };
  return null;
}

const CHAR_FACE = Object.fromEntries(CHARS.map((c) => [c.n, c.f]));

function fmtDuration(s) {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}分${sec}秒` : `${sec}秒`;
}

/** ① 报名处：选身份 + 双榜 */
export function SelectScreen({ onStart, onStartDaily, toast, boardProps, equipment = {}, dailyBoard = null }) {
  const [picked, setPicked] = useState('');
  const [showOppHistory, setShowOppHistory] = useState(false);
  const records = useMemo(() => loadLocalRecords(), []);
  const seenOpps = useMemo(() => new Set(records.map((r) => r.o)), [records]);
  const seenCount = seenOpps.size;
  const totalOpps = CHARS.length;
  const oppWinRateMap = useMemo(() => {
    const map = {};
    for (const r of records) {
      if (!map[r.o]) map[r.o] = { wins: 0, total: 0 };
      map[r.o].total++;
      if (r.sp > r.so) map[r.o].wins++;
    }
    return map;
  }, [records]);
  const charStatsMap = useMemo(() => computeCharStats(records), [records]);
  const bestChar = useMemo(() => findBestChar(charStatsMap), [charStatsMap]);

  const dailyChallenge = useMemo(() => (picked ? getDailyChallenge(picked) : null), [picked]);
  const dailyDone = picked ? isDailyChallengeCompleted() : false;
  const myDailyStats = useMemo(() => (picked ? loadDailyStats(picked) : null), [picked]);
  const myDailyRank = useMemo(
    () => computeDailyRank(dailyBoard?.completions, picked),
    [dailyBoard, picked],
  );

  const handleStart = () => {
    if (!picked) {
      toast('裁判：请先选好你是谁再上场！');
      return;
    }
    onStart(picked);
  };

  return (
    <section className="screen">
      <div className="card">
        <h2>① 报名处 · 你是哪位选手？</h2>
        <p className="hint">选好身份后，系统会从剩下 6 位家人里随机抽出你的「宿敌」，并偷偷给 ta 摇好属性（40–90）。</p>
        <div className="select-row">
          <select
            className="player-select"
            aria-label="选择你的身份"
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
          >
            <option value="" disabled>—— 请选择你的身份 ——</option>
            {CHARS.map((c) => (
              <option key={c.n} value={c.n}>{c.f} {c.n}</option>
            ))}
          </select>
          <button type="button" className="btn" onClick={handleStart}>入场检录 →</button>
        </div>
        <div className="roster">
          {CHARS.map((c) => {
            const cs = charStatsMap[c.n];
            return (
              <div className="chip" key={c.n}>
                <span className="face">{c.f}</span>
                <span className="nm">{c.n}</span>
                {bestChar === c.n && (
                  <span className="best-char-star">✦ 最佳</span>
                )}
                {cs && (
                  <span className="char-stat">出战 {cs.played} · 赢 {cs.won}</span>
                )}
              </div>
            );
          })}
        </div>
        {dailyChallenge && (
          <div className={`daily-banner${dailyDone ? ' daily-banner-done' : ''}`}>
            <div className="daily-header">
              <span className="daily-label">⚡ 今日一战</span>
              <span className="daily-date">{dailyChallenge.date}</span>
              {dailyDone && <span className="daily-done-badge">✓ 今日已完成</span>}
            </div>
            <div className="daily-body">
              <span className="daily-face">{dailyChallenge.foe.f}</span>
              <div className="daily-info">
                <span className="daily-opp-name">{dailyChallenge.foe.n}</span>
                <span className="daily-stats">
                  体力 {dailyChallenge.stats.sta} · 技巧 {dailyChallenge.stats.skill} · 心理 {dailyChallenge.stats.mind}
                </span>
              </div>
              {!dailyDone && (
                <button
                  type="button"
                  className="btn btn-daily"
                  onClick={() => onStartDaily && onStartDaily(picked)}
                >
                  今日一战 +{DAILY_BONUS_COINS}💰
                </button>
              )}
              {dailyDone && <span className="daily-done-msg">明天再来挑战！🎾</span>}
            </div>
          </div>
        )}
        {dailyBoard && dailyBoard.completions.length > 0 && (() => {
          const sliced = dailyBoard.completions.slice(0, 7);
          const meInList = picked && sliced.some((c) => c.player_name === picked);
          const winners = sliced.filter((c) => c.won && c.duration_s > 0);
          const fastestDur = winners.length > 0 ? Math.min(...winners.map((c) => c.duration_s)) : null;
          const fastestName = fastestDur !== null ? winners.find((c) => c.duration_s === fastestDur)?.player_name : null;
          return (
            <div className="daily-completions">
              <span className="daily-completions-label">
                今日出战 · {dailyBoard.completions.length} 位家人{meInList ? ' · 包括你' : ''}
              </span>
              <ul className="daily-completions-list">
                {sliced.map((c) => {
                  const isMe = picked && c.player_name === picked;
                  const isFastest = fastestName && c.player_name === fastestName && c.won && c.duration_s === fastestDur;
                  return (
                    <li key={c.player_name} className={`dc-entry${c.won ? ' dc-won' : ' dc-lost'}${isMe ? ' dc-me' : ''}`}>
                      <span className="dc-player">{CHAR_FACE[c.player_name] ?? ''} {c.player_name}</span>
                      {isMe && <span className="dc-me-badge">你</span>}
                      {isFastest && <span className="dc-fastest-badge">⚡ 最速</span>}
                      <span className="dc-arrow">→</span>
                      <span className="dc-foe">{CHAR_FACE[c.foe_name] ?? ''} {c.foe_name}</span>
                      <span className="dc-result">{c.won ? '✓ 胜' : '✗ 败'}</span>
                      {c.duration_s > 0 && <span className="dc-dur">{fmtDuration(c.duration_s)}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })()}
        {myDailyStats && (
          <div className={`my-daily-stats${myDailyStats.won ? ' my-daily-stats-win' : ' my-daily-stats-loss'}`}>
            <span className="my-daily-stats-label">
              {myDailyStats.won ? '🏆' : '🎾'} 我的今日得分
            </span>
            <span className={`my-daily-result${myDailyStats.won ? ' win' : ' loss'}`}>
              {myDailyStats.won ? '胜' : '败'} {myDailyStats.setsP}:{myDailyStats.setsO}
            </span>
            {myDailyStats.aces > 0 && (
              <span className="my-daily-chip">ACE ×{myDailyStats.aces}</span>
            )}
            {myDailyStats.clutchWins > 0 && (
              <span className="my-daily-chip">关键分 ×{myDailyStats.clutchWins}</span>
            )}
            {myDailyStats.countersWon > 0 && (
              <span className="my-daily-chip">克制 ×{myDailyStats.countersWon}</span>
            )}
            {myDailyStats.avgMultiplier !== null && (
              <span className="my-daily-chip">操作 {myDailyStats.avgMultiplier}×</span>
            )}
            {myDailyStats.won && myDailyRank !== null && (
              <span className="my-daily-chip my-daily-rank-chip">⚡ 第 {myDailyRank} 快</span>
            )}
          </div>
        )}
        {seenCount > 0 && (
          <div className="opp-progress">
            <button
              type="button"
              className="opp-progress-toggle"
              onClick={() => setShowOppHistory((v) => !v)}
              aria-expanded={showOppHistory}
            >
              <span>
                已挑战 {seenCount}/{totalOpps} 位家人
                {seenCount === totalOpps && '　🏅 全家大挑战完成！'}
              </span>
              <span className="opp-progress-chevron">{showOppHistory ? '▲' : '▼'}</span>
            </button>
            <div className="opp-progress-bar">
              <div className="opp-progress-fill" style={{ width: `${(seenCount / totalOpps) * 100}%` }} />
            </div>
            {showOppHistory && (
              <div className="opp-history-panel">
                {CHARS.map((c) => {
                  const tag = seenOpps.has(c.n) ? getOppTag(c.n, oppWinRateMap) : null;
                  return (
                    <div key={c.n} className={`opp-history-chip${seenOpps.has(c.n) ? ' seen' : ' unseen'}`}>
                      <span className="opp-history-face">{c.f}</span>
                      <span className="opp-history-name">{c.n}</span>
                      {seenOpps.has(c.n) ? (
                        <>
                          <span className="opp-history-badge">✓</span>
                          {tag && <span className={`opp-tag ${tag.cls}`}>{tag.label}</span>}
                          {oppWinRateMap[c.n] && (
                            <span className="opp-wr">{oppWinRateMap[c.n].wins}/{oppWinRateMap[c.n].total}</span>
                          )}
                        </>
                      ) : (
                        <span className="opp-history-badge opp-history-new">NEW</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div className="equip-mini-bar">
          <span className="equip-mini-label">🎒 当前装备：</span>
          {EQUIPMENT_SLOTS.map((slot) => {
            const item = equipment[slot];
            const meta = SLOT_META[slot];
            const color = item ? RARITY_META[item.rarity].color : 'rgba(242,238,224,0.2)';
            return (
              <span
                key={slot}
                className="equip-mini-chip"
                style={{ borderColor: color, color: item ? color : 'rgba(242,238,224,0.3)' }}
                title={item ? `${meta.name}（${RARITY_META[item.rarity].name}）` : `${meta.name}（空）`}
              >
                {meta.icon}
                {item && <span className="equip-mini-rarity">{RARITY_META[item.rarity].name[0]}</span>}
              </span>
            );
          })}
        </div>
        <div className="rule-strip">
          <span>三局两胜</span><span>每盘 3 球，赢 2 球拿下一盘</span><span>反应测试决定天赋</span><span>4 轮备战加点</span>
        </div>
      </div>

      <div className="card flat">
        <h2>🏆 历史战绩榜</h2>
        <p className="hint">全网榜云端保存，本地榜谁也别想赖账。</p>
        <Leaderboard {...boardProps} />
      </div>
    </section>
  );
}
