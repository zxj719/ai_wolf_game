/**
 * SprintScreen.jsx — 限时冲刺模式
 *
 * 15 分钟内尽量多打比赛：赢 +3 分，输 +1 分（参与奖），计时结束结算。
 * 对手随机抽取（中等属性 45-75），无备战加点（靠备战阶段的底子）。
 * 掉落/金币正常入 progress，遥测上报 mode='sprint'。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { BattleScreen } from '../battle/BattleScreen';
import { CHAR_BUILDS } from '../battle/moves';
import { CHARS } from '../gameData';
import { applyEquipment, rollDrop, mergeDrop, RARITY_META, SLOT_META } from '../meta/equipment';
import { sendMatchTelemetry } from '../../../services/tennisService';
import { incrementNoviceGames } from '../meta/noviceTracker';
import { saveSprintHiscore, loadSprintHiscores, isToday, getTodayEffBoard } from './sprintScores';

export const SPRINT_DURATION_S = 15 * 60;
export const WIN_PTS = 3;
export const LOSS_PTS = 1;

export function computeGrade(pts) {
  if (pts >= 30) return { label: '传说冲分王', icon: '🏆' };
  if (pts >= 18) return { label: '进阶冲刺手', icon: '🥈' };
  if (pts >= 9)  return { label: '坚持就是胜利', icon: '🥉' };
  return { label: '参与奖领取中…', icon: '🎾' };
}

export function buildShareText({ totalPts, matchCount, winCount, grade }) {
  return `⏱️ 限时15分钟 · ${totalPts}分 · ${matchCount}场 · ${winCount}胜 · ${grade.label}${grade.icon}`;
}

const SPRINT_DECK = [
  { cardId: 'towelTime', upgraded: false },
  { cardId: 'newBalls', upgraded: false },
  { cardId: 'coachSign', upgraded: false },
  { cardId: 'deepBreath', upgraded: false },
];

export function randomOpp(playerName, rng = Math.random) {
  const pool = CHARS.filter((c) => c.n !== playerName);
  const c = pool[Math.floor(rng() * pool.length)];
  const base = 45;
  const spread = 30;
  return {
    name: c.n,
    face: c.f,
    sta: base + Math.floor(rng() * spread),
    skill: base + Math.floor(rng() * spread),
    mind: base + Math.floor(rng() * spread),
  };
}

export function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function SprintScreen({ basePlayer, progress, onUpdateProgress, equippedUltimate, onExit, toast }) {
  // phase: 'playing' = in BattleScreen | 'between' = interstitial | 'done' = summary
  const [phase, setPhase] = useState('playing');
  const [timeLeft, setTimeLeft] = useState(SPRINT_DURATION_S);
  const [currentOpp, setCurrentOpp] = useState(() => randomOpp(basePlayer.name));
  const [results, setResults] = useState([]);
  const [copied, setCopied] = useState(false);
  const [hiRank, setHiRank] = useState(null);

  // Ref mirrors timeLeft to avoid stale closure in handleMatchOver
  const timeLeftRef = useRef(SPRINT_DURATION_S);
  const timerRef = useRef(null);
  // Marks the timestamp of the saved hiscore entry (for row highlight in leaderboard)
  const currentTsRef = useRef(null);
  // Guard against double-saving (effect may run with stale phase in dev strict mode)
  const hiSavedRef = useRef(false);

  const equipBonus = applyEquipment(progress.equipment);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        const next = Math.max(0, t - 1);
        timeLeftRef.current = next;
        if (next <= 0) clearInterval(timerRef.current);
        return next;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // When time runs out between matches, move straight to done
  useEffect(() => {
    if (timeLeft === 0 && phase === 'between') setPhase('done');
  }, [timeLeft, phase]);

  // Save hiscore once when phase transitions to 'done' (React 18 batching ensures results is final)
  useEffect(() => {
    if (phase !== 'done' || hiSavedRef.current || results.length === 0) return;
    hiSavedRef.current = true;
    const pts = results.reduce((s, r) => s + r.pts, 0);
    const wins = results.filter((r) => r.win).length;
    const g = computeGrade(pts);
    const now = Date.now();
    currentTsRef.current = now;
    const { rank } = saveSprintHiscore({
      totalPts: pts, matchCount: results.length, winCount: wins,
      grade: g, playerName: basePlayer.name,
    }, { now });
    setHiRank(rank);
  }, [phase, results, basePlayer.name]);

  const handleMatchOver = useCallback(({ score, matchStats, durationS }) => {
    const win = score.winner === 0;
    const pts = win ? WIN_PTS : LOSS_PTS;

    incrementNoviceGames();
    sendMatchTelemetry({
      mode: 'sprint',
      character: basePlayer.name,
      opponent: currentOpp.name,
      score,
      matchStats,
      durationS,
    });

    const drop = rollDrop(win ? 'win' : 'loss', Math.random);
    const coins = win ? 20 : 8;
    const { equipped, soldFor } = mergeDrop(progress.equipment, drop);
    onUpdateProgress({
      ...progress,
      coins: progress.coins + coins + soldFor,
      equipment: equipped,
    });
    toast(`${win ? '🏆 胜' : '💪 负'} +${pts}分 · 🎁 ${RARITY_META[drop.rarity].name}${SLOT_META[drop.slot].name} +${coins + soldFor}💰`);

    const newResult = { oppName: currentOpp.name, oppFace: currentOpp.face, win, pts };
    setResults((prev) => [...prev, newResult]);

    if (timeLeftRef.current <= 0) {
      setPhase('done');
    } else {
      setPhase('between');
    }
  }, [basePlayer.name, currentOpp, progress, onUpdateProgress, toast]);

  const startNextMatch = useCallback(() => {
    setCurrentOpp(randomOpp(basePlayer.name));
    setPhase('playing');
  }, [basePlayer.name]);

  const totalPts = results.reduce((s, r) => s + r.pts, 0);
  const winCount = results.filter((r) => r.win).length;
  const lastResult = results[results.length - 1] ?? null;

  const timerColor = timeLeft < 60 ? '#ef4444' : timeLeft < 180 ? '#f59e0b' : '#22d3ee';

  if (phase === 'done') {
    const grade = computeGrade(totalPts);
    const allHiscores = loadSprintHiscores();
    const hiscores = allHiscores.slice(0, 5);
    const todayEffBoard = getTodayEffBoard(allHiscores);
    const myEffRank = currentTsRef.current
      ? todayEffBoard.findIndex((s) => s.ts === currentTsRef.current) + 1
      : 0;
    const isEffChamp = myEffRank === 1 && todayEffBoard.length >= 2;

    const shareText = buildShareText({ totalPts, matchCount: results.length, winCount, grade });

    const handleCopy = () => {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(shareText).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      } else {
        const ta = document.createElement('textarea');
        ta.value = shareText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    };

    return (
      <section className="screen">
        <div className="card">
          <h2>⏱️ 限时冲刺 · 结算</h2>
          <div style={{ textAlign: 'center', margin: '18px 0' }}>
            <div style={{ fontSize: '3.2rem', fontWeight: 900 }}>{totalPts} 分</div>
            <div style={{ fontSize: '1.1rem', marginTop: 6 }}>
              {grade.icon} {grade.label}
            </div>
            <div style={{ opacity: 0.65, marginTop: 6, fontSize: '0.9rem' }}>
              {results.length} 场对战 · {winCount} 胜 {results.length - winCount} 负
            </div>
          </div>

          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
              {results.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', justifyContent: 'space-between',
                    padding: '5px 10px', borderRadius: 7,
                    background: r.win ? 'rgba(74,222,128,.14)' : 'rgba(239,68,68,.11)',
                    fontSize: '0.88rem',
                  }}
                >
                  <span>{r.oppFace} {r.oppName}</span>
                  <span style={{ fontWeight: 600 }}>{r.win ? '胜 ✅' : '负 ❌'} +{r.pts}分</span>
                </div>
              ))}
            </div>
          )}

          {results.length === 0 && (
            <p className="hint" style={{ textAlign: 'center' }}>本轮未完成任何对局</p>
          )}

          {(hiRank !== null || isEffChamp) && (
            <div style={{ textAlign: 'center', padding: '6px 0 10px' }}>
              {hiRank !== null && (
                <div style={{
                  color: hiRank === 1 ? '#facc15' : hiRank <= 3 ? '#22d3ee' : '#a3e635',
                  fontSize: '0.95rem', fontWeight: 700,
                }}>
                  {hiRank === 1 ? '🥇 家族历史最高分！' : hiRank <= 3 ? `🏅 家族第 ${hiRank} 名！` : `📊 榜单第 ${hiRank} 名`}
                </div>
              )}
              {isEffChamp && (
                <div style={{ color: '#22d3ee', fontWeight: 600, fontSize: '0.85rem', marginTop: 2 }}>
                  ⚡ 今日效率冠军！
                </div>
              )}
            </div>
          )}

          {hiscores.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.45, textAlign: 'center', marginBottom: 5 }}>
                🏠 家族冲刺榜
              </div>
              {hiscores.map((s, i) => {
                const isCurrent = s.ts === currentTsRef.current;
                const todayEntry = !isCurrent && isToday(s.ts);
                return (
                  <div key={s.ts} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 8px', borderRadius: 6,
                    background: isCurrent
                      ? 'rgba(250,204,21,.14)'
                      : todayEntry ? 'rgba(34,211,238,.09)' : 'transparent',
                    fontSize: '0.82rem',
                  }}>
                    <span style={{ minWidth: 22, opacity: 0.55 }}>#{i + 1}</span>
                    <span style={{ flex: 1 }}>{s.player}</span>
                    <span style={{ fontWeight: 700 }}>{s.pts}分</span>
                    <span style={{ marginLeft: 4 }}>{s.grade.icon}</span>
                    {todayEntry && (
                      <span style={{
                        fontSize: '0.65rem', color: '#22d3ee',
                        border: '1px solid rgba(34,211,238,.4)',
                        borderRadius: 3, padding: '0 3px', lineHeight: '1.4',
                      }}>☀️今日</span>
                    )}
                    <span style={{ opacity: 0.45, fontSize: '0.72rem', marginLeft: 4 }}>{s.date}</span>
                  </div>
                );
              })}
            </div>
          )}

          {todayEffBoard.length >= 2 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.45, textAlign: 'center', marginBottom: 5 }}>
                ⚡ 今日效率排名
              </div>
              {todayEffBoard.slice(0, 3).map((s, i) => {
                const isCurrent = s.ts === currentTsRef.current;
                const eff = (s.pts / s.matches).toFixed(1);
                return (
                  <div
                    key={s.ts}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '4px 8px', borderRadius: 6,
                      background: isCurrent ? 'rgba(34,211,238,.12)' : 'transparent',
                      fontSize: '0.82rem',
                    }}
                  >
                    <span style={{ minWidth: 22, opacity: 0.55 }}>#{i + 1}</span>
                    <span style={{ flex: 1 }}>{s.player}</span>
                    <span style={{ fontWeight: 700, color: '#22d3ee' }}>{eff}分/场</span>
                    <span style={{ opacity: 0.5, fontSize: '0.72rem' }}>{s.pts}分·{s.matches}场</span>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <button
              type="button"
              className="btn ghost"
              onClick={handleCopy}
              style={{ flex: 1 }}
              aria-label="复制成绩文字"
            >
              {copied ? '✅ 已复制' : '📋 复制成绩'}
            </button>
          </div>

          <button type="button" className="btn" onClick={onExit} style={{ width: '100%' }}>
            🏠 返回模式选择
          </button>
        </div>
      </section>
    );
  }

  if (phase === 'between') {
    return (
      <section className="screen">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ margin: 0 }}>⏱️ 限时冲刺</h2>
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: timerColor, fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(timeLeft)}
            </span>
          </div>

          <div style={{ textAlign: 'center', margin: '12px 0' }}>
            <div style={{ fontSize: '2.4rem', fontWeight: 900 }}>{totalPts} 分</div>
            <div style={{ opacity: 0.7, fontSize: '0.9rem', marginTop: 4 }}>
              {results.length} 场 · {winCount} 胜 {results.length - winCount} 负
            </div>
          </div>

          {lastResult && (
            <div style={{
              padding: '8px 12px', borderRadius: 8, marginBottom: 14, textAlign: 'center',
              background: lastResult.win ? 'rgba(74,222,128,.14)' : 'rgba(239,68,68,.11)',
              fontSize: '0.95rem',
            }}>
              对阵 {lastResult.oppFace} {lastResult.oppName}：
              <strong>{lastResult.win ? ' 胜！+3分 🎉' : ' 负！+1分 💪'}</strong>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn" onClick={startNextMatch} style={{ flex: 2 }}>
              ⚡ 继续冲刺
            </button>
            <button type="button" className="btn ghost" onClick={() => setPhase('done')} style={{ flex: 1 }}>
              结束
            </button>
          </div>
        </div>
      </section>
    );
  }

  // phase === 'playing': in-match view
  return (
    <section className="screen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px 10px' }}>
        <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>
          ⚡ 冲刺 · {totalPts}分 · {results.length}场
        </span>
        <span style={{ fontWeight: 700, color: timerColor, fontVariantNumeric: 'tabular-nums' }}>
          ⏱ {formatTime(timeLeft)}
        </span>
      </div>
      <BattleScreen
        player={basePlayer}
        opponent={currentOpp}
        playerMoves={CHAR_BUILDS[basePlayer.name].moves}
        deckInstances={SPRINT_DECK}
        ultimate={equippedUltimate}
        equip={equipBonus}
        onMatchOver={handleMatchOver}
        isFirstMatch={false}
      />
    </section>
  );
}
