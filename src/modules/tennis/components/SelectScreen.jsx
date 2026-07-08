import { useState, useMemo, useEffect } from 'react';
import { CHARS } from '../gameData';
import { Leaderboard } from './Leaderboard';
import { EQUIPMENT_SLOTS, SLOT_META, RARITY_META } from '../meta/equipment';
import { loadLocalRecords, computeCharStats, findBestChar, findMainChar, computeCurrentWinStreak, computeRecentResults, computeOppRecentResults, computeOppWinStreak, computeOppLastBattleTs, computeOppBestWinStreak, sortOppChars, findRevengeOpportunity, computePlayerOppWinRates, computeTopRallyByChar } from '../localBoard';
import { getDailyChallenge, isDailyChallengeCompleted, loadDailyStats, computeDailyRank, loadDailyStreak, DAILY_BONUS_COINS } from '../meta/dailyChallenge';
import { CHAR_BUILDS, COUNTER_PAIRS, MOVES } from '../battle/moves';

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

function fmtChampDate(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** ① 报名处：选身份 + 双榜 */
export function SelectScreen({ onStart, onStartDaily, toast, boardProps, equipment = {}, dailyBoard = null, familyChampAt = null, onFamilyChamp }) {
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
  const topRallyByChar = useMemo(() => computeTopRallyByChar(records), [records]);
  const bestChar = useMemo(() => findBestChar(charStatsMap), [charStatsMap]);
  const mainChar = useMemo(() => findMainChar(charStatsMap), [charStatsMap]);
  const currentWinStreak = useMemo(
    () => (picked ? computeCurrentWinStreak(records, picked) : 0),
    [picked, records],
  );
  const recentResultsMap = useMemo(() => {
    const map = {};
    for (const c of CHARS) {
      const res = computeRecentResults(records, c.n);
      if (res.length > 0) map[c.n] = res;
    }
    return map;
  }, [records]);
  const oppTrendMap = useMemo(() => {
    if (!picked) return {};
    const map = {};
    for (const c of CHARS) {
      const res = computeOppRecentResults(records, picked, c.n);
      if (res.length > 0) map[c.n] = res;
    }
    return map;
  }, [records, picked]);
  const oppStreakMap = useMemo(() => {
    if (!picked) return {};
    const map = {};
    for (const c of CHARS) {
      const streak = computeOppWinStreak(records, picked, c.n);
      if (streak >= 2) map[c.n] = streak;
    }
    return map;
  }, [records, picked]);
  const oppLastBattleMap = useMemo(() => {
    if (!picked) return {};
    const map = {};
    for (const c of CHARS) {
      const ts = computeOppLastBattleTs(records, picked, c.n);
      if (ts !== null) map[c.n] = ts;
    }
    return map;
  }, [records, picked]);
  const oppBestStreakMap = useMemo(() => {
    if (!picked) return {};
    const map = {};
    for (const c of CHARS) {
      const best = computeOppBestWinStreak(records, picked, c.n);
      if (best >= 2) map[c.n] = best;
    }
    return map;
  }, [records, picked]);

  const matchupMap = useMemo(() => {
    if (!picked) return {};
    const playerMoves = CHAR_BUILDS[picked]?.moves ?? [];
    const map = {};
    for (const c of CHARS) {
      if (c.n === picked) continue;
      const oppMoves = CHAR_BUILDS[c.n]?.moves ?? [];
      for (const [counter, victim] of COUNTER_PAIRS) {
        if (playerMoves.includes(counter) && oppMoves.includes(victim)) {
          map[c.n] = counter;
          break;
        }
      }
    }
    return map;
  }, [picked]);

  const playerOppWrMap = useMemo(
    () => (picked ? computePlayerOppWinRates(records, picked) : {}),
    [records, picked],
  );

  const sortedOppChars = useMemo(
    () => sortOppChars(CHARS, seenOpps, oppWinRateMap),
    [seenOpps, oppWinRateMap],
  );

  const revengeOpp = useMemo(() => {
    if (!picked) return null;
    const result = findRevengeOpportunity(records, picked);
    // 若复仇目标与今日一战相同，避免重复展示
    if (result && dailyChallenge && result.name === dailyChallenge.foe.n) return null;
    return result;
  }, [records, picked, dailyChallenge]);

  useEffect(() => {
    if (seenCount === totalOpps && !familyChampAt && onFamilyChamp) {
      onFamilyChamp(Date.now());
    }
  }, [seenCount, totalOpps, familyChampAt, onFamilyChamp]);

  const dailyChallenge = useMemo(() => (picked ? getDailyChallenge(picked) : null), [picked]);
  const dailyDone = picked ? isDailyChallengeCompleted() : false;
  const dailyStreak = loadDailyStreak();
  const myDailyStats = useMemo(() => (picked ? loadDailyStats(picked) : null), [picked]);
  const myDailyRank = useMemo(
    () => (picked && dailyBoard ? computeDailyRank(picked, dailyBoard.completions) : null),
    [picked, dailyBoard],
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
                {mainChar === c.n && (
                  <span className="main-char-tag">⭐ 主力</span>
                )}
                {cs && (
                  <span className="char-stat">出战 {cs.played} · 赢 {cs.won}</span>
                )}
                {topRallyByChar[c.n] && (
                  <span
                    className={`char-best-rally${topRallyByChar[c.n].cl ? ' cbr-clutch' : ''}`}
                    title={`以${c.n}出战时最佳一击：${topRallyByChar[c.n].mult}×${topRallyByChar[c.n].ctr ? '（克制）' : ''}`}
                  >
                    ✨ {topRallyByChar[c.n].mult}×
                  </span>
                )}
                {recentResultsMap[c.n] && (
                  <span className="char-trend" aria-label={`近${recentResultsMap[c.n].length}局`}>
                    {recentResultsMap[c.n].map((won, i) => (
                      <span key={i} className={`ct-dot${won ? ' ct-w' : ' ct-l'}`} />
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {currentWinStreak >= 3 && (
          <div className={`select-streak-banner${currentWinStreak >= 10 ? ' ssb-legend' : currentWinStreak >= 5 ? ' ssb-gold' : ''}`}>
            <span className="ssb-fire">
              {currentWinStreak >= 10 ? '🔥🔥🔥' : currentWinStreak >= 5 ? '🔥🔥' : '🔥'}
            </span>
            <span className="ssb-text">
              {currentWinStreak >= 10
                ? `连胜 ${currentWinStreak} 场！家族传奇！再战证明霸主地位！`
                : currentWinStreak >= 5
                  ? `连胜 ${currentWinStreak} 场！势不可挡，挑战新对手！`
                  : `连胜 ${currentWinStreak} 场！状态正热，继续！`}
            </span>
            <span className={`ladder-streak${currentWinStreak >= 10 ? ' streak-gold' : ' streak-pulse'}`}>
              {currentWinStreak} 连胜
            </span>
          </div>
        )}
        {dailyChallenge && (
          <div className={`daily-banner${dailyDone ? ' daily-banner-done' : ''}`}>
            <div className="daily-header">
              <span className="daily-label">⚡ 今日一战</span>
              <span className="daily-date">{dailyChallenge.date}</span>
              {dailyStreak >= 2 && (
                <span className={`daily-streak-badge${dailyStreak >= 7 ? ' daily-streak-fire' : ''}`}>
                  {dailyStreak >= 7 ? '🔥' : '⚡'} {dailyStreak} 天连续
                </span>
              )}
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
            {myDailyRank !== null && (
              <span className={`my-daily-chip my-daily-rank-chip${myDailyRank === 1 ? ' my-daily-rank-first' : ''}`}>
                {myDailyRank === 1 ? '⚡ 最速' : `第 ${myDailyRank} 快`}
              </span>
            )}
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
            {myDailyStats.topRally && (
              <span className="my-daily-chip my-daily-chip-best" title={`今日一战最佳一击：${myDailyStats.topRally.mult}×${myDailyStats.topRally.ctr ? '（克制）' : ''}`}>
                ✨ 最佳一击 {myDailyStats.topRally.mult}×
              </span>
            )}
          </div>
        )}
        {revengeOpp && (
          <div className="revenge-banner" role="status">
            <span className="revenge-icon">😤</span>
            <span className="revenge-text">
              {revengeOpp.face} <strong>{revengeOpp.name}</strong> 还欠你一局！
              {revengeOpp.daysAgo === 0 ? '今天' : revengeOpp.daysAgo === 1 ? '昨天' : `${revengeOpp.daysAgo}天前`}
              输的，该复仇了！
            </span>
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
            {familyChampAt && seenCount === totalOpps && (
              <div className="family-champ-badge" role="status" aria-label="全家制霸成就">
                <span className="fcb-icon">🏆</span>
                <span className="fcb-title">全家制霸！</span>
                <span className="fcb-date">首次达成：{fmtChampDate(familyChampAt)}</span>
              </div>
            )}
            {showOppHistory && (
              <div className="opp-history-panel">
                <div className="opp-sort-hint" aria-label="对手排序说明">
                  按胜率排序：<span className="osp-recommend">推荐</span> · <span className="osp-neutral">中立</span> · <span className="osp-rival">劲敌</span> · <span className="osp-new">NEW</span>
                </div>
                {sortedOppChars.map((c) => {
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
                          {oppTrendMap[c.n] && (
                            <span className="opp-trend" aria-label={`近${oppTrendMap[c.n].length}局对战`}>
                              {oppTrendMap[c.n].map((won, i) => (
                                <span key={i} className={`ot-dot${won ? ' ot-w' : ' ot-l'}`} />
                              ))}
                            </span>
                          )}
                          {oppStreakMap[c.n] && (
                            <span className="opp-streak-badge" aria-label={`对该对手连胜${oppStreakMap[c.n]}场`}>
                              🔥{oppStreakMap[c.n]}连
                            </span>
                          )}
                          {oppBestStreakMap[c.n] >= 2 && oppBestStreakMap[c.n] > (oppStreakMap[c.n] ?? 0) && (
                            <span className="opp-best-streak" aria-label={`历史最高连胜${oppBestStreakMap[c.n]}场`}>
                              最高 {oppBestStreakMap[c.n]}连
                            </span>
                          )}
                          {oppLastBattleMap[c.n] != null && (() => {
                            const diffDays = Math.floor((Date.now() - oppLastBattleMap[c.n]) / 86400000);
                            const label = diffDays === 0 ? '今日' : diffDays === 1 ? '昨日' : `${diffDays}天前`;
                            return <span className="opp-last-date">{label}</span>;
                          })()}
                        </>
                      ) : (
                        <span className="opp-history-badge opp-history-new">NEW</span>
                      )}
                      {picked && matchupMap[c.n] && (
                        <span className="matchup-hint" aria-label={`出${MOVES[matchupMap[c.n]].name}可克制对方`}>
                          🎯 {MOVES[matchupMap[c.n]].name}
                          {playerOppWrMap[c.n]?.total >= 2 && (
                            <span className="matchup-wr-sub">
                              以此 {playerOppWrMap[c.n].wins}/{playerOppWrMap[c.n].total}
                            </span>
                          )}
                        </span>
                      )}
                      {picked && c.n !== picked && !matchupMap[c.n] && (
                        <span className="matchup-hint matchup-balanced" aria-label="均势对阵，无直接克制">
                          ⚡ 均势
                        </span>
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
