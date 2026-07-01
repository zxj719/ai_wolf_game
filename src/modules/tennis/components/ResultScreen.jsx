import { useEffect, useMemo, useRef } from 'react';
import { ENDINGS, CHAR_QUOTES, rand } from '../gameData';
import { MOVES, COUNTER_QUIPS } from '../battle/moves';
import { saveLocalRecord, loadLocalRecords, computeStreakCount, computeWeeklyChamp, loadPrevPrepStats } from '../localBoard';
import { getPostMatchCommentary } from '../commentary';
import { saveTennisRecord } from '../../../services/tennisService';
import { Leaderboard } from './Leaderboard';
import { FeedbackWidget } from './FeedbackWidget';

const MOVE_ICONS = {
  flatDrive: '💥', smash: '🔨', topspin: '🌀', slice: '✂️',
  volley: '⚡', dropShot: '🎯', lob: '🏹', passingShot: '🏃',
};

// Derive "first counter for move X" from COUNTER_QUIPS key format 'a>b' (a counters b)
const COUNTER_FOR = {};
for (const key of Object.keys(COUNTER_QUIPS)) {
  const [a, b] = key.split('>');
  if (!COUNTER_FOR[b]) COUNTER_FOR[b] = a;
}

function fmtDuration(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m} 分 ${sec} 秒` : `${sec} 秒`;
}

/** ⑤ 结局 + 战报 + 双榜。挂载时本地入榜 + 登录用户上传全网榜。 */
export function ResultScreen({ state, dispatch, user, toast, onRecorded, boardProps, matchStats }) {
  const ending = ENDINGS[`${state.setsP}-${state.setsO}`];
  const { player: p, opp: o } = state;
  const playerWon = state.setsP > state.setsO;
  const oppQuotePool = CHAR_QUOTES[o.name]?.[playerWon ? 'defeated' : 'victory'];
  const oppQuote = oppQuotePool ? oppQuotePool[rand(0, oppQuotePool.length - 1)] : null;
  const recordedRef = useRef(false);

  // 连胜/连败计算：读取当前游戏保存前的历史记录（effect 尚未运行），加上本局结果
  const winStreak = useMemo(() => {
    if (!playerWon) return 0;
    return computeStreakCount(loadLocalRecords(), p.name, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lossStreak = useMemo(() => {
    if (playerWon) return 0;
    return computeStreakCount(loadLocalRecords(), p.name, false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 含当前局的周度最强：把本局虚拟入历史后再算（save effect 异步，useMemo 先跑）
  const weeklyChampName = useMemo(() => {
    const preRecords = loadLocalRecords();
    const curRecord = { p: p.name, pf: p.face, sp: state.setsP, so: state.setsO, ts: Date.now() };
    return computeWeeklyChamp([...preRecords, curRecord])?.name ?? null;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const postComment = useMemo(() => getPostMatchCommentary({
    playerName: p.name,
    oppName: o.name,
    playerFace: p.face,
    playerWon,
    setsP: state.setsP,
    setsO: state.setsO,
    aces: matchStats?.aces ?? 0,
    clutchWins: matchStats?.clutchWins ?? 0,
    countersWon: matchStats?.countersWon ?? 0,
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const topMoveEntry = useMemo(() => {
    if (!matchStats?.moveUsage) return null;
    const entries = Object.entries(matchStats.moveUsage);
    return entries.length ? entries.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;
  }, [matchStats]);

  const topOppMoves = useMemo(() => {
    if (!matchStats?.oppMoveUsage) return [];
    return Object.entries(matchStats.oppMoveUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([moveId, count]) => ({
        moveId,
        count,
        name: MOVES[moveId]?.name ?? moveId,
        icon: MOVE_ICONS[moveId] ?? '🎾',
        counter: COUNTER_FOR[moveId] ? MOVES[COUNTER_FOR[moveId]]?.name : null,
      }));
  }, [matchStats]);

  const topPlayerMoves = useMemo(() => {
    if (!matchStats?.moveUsage) return [];
    return Object.entries(matchStats.moveUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([moveId, count]) => ({
        moveId,
        count,
        name: MOVES[moveId]?.name ?? moveId,
        icon: MOVE_ICONS[moveId] ?? '🎾',
        beatenBy: COUNTER_FOR[moveId] ? MOVES[COUNTER_FOR[moveId]]?.name : null,
      }));
  }, [matchStats]);

  const playerSelfNote = useMemo(() => {
    if (!topPlayerMoves.length) return null;
    const top1 = topPlayerMoves[0];
    if (top1.beatenBy) {
      return `你最常出「${top1.name}」，对手若出「${top1.beatenBy}」可以克制你，下次注意换招`;
    }
    return null;
  }, [topPlayerMoves]);

  const nextAdvice = useMemo(() => {
    if (!topOppMoves.length) return null;
    const top1 = topOppMoves[0];
    if (top1.counter) {
      return `下次多出「${top1.counter}」来破解 ${o.name} 惯用的${top1.name}`;
    }
    return `${o.name} 本局偏爱${top1.name}，提前读招可增加克制得分`;
  }, [topOppMoves, o.name]);

  const nextPrepHint = useMemo(() => {
    const { sta, skill, mind, name } = o;
    const dominant = sta >= skill && sta >= mind ? '体力' : skill >= mind ? '技巧' : '心态';
    const val = dominant === '体力' ? sta : dominant === '技巧' ? skill : mind;
    const adviceAttr = dominant === '体力' ? '技巧或心态' : dominant === '技巧' ? '体力或心态' : '体力或技巧';
    return `${name} 今日${dominant}见长（${val}），下次备战可优先加点${adviceAttr}`;
  }, [o]);

  // 较上次备战同一对手的属性增减（需至少两次对该对手的完整备战周期）
  const prepGrowthData = useMemo(() => {
    const prev = loadPrevPrepStats(p.name, o.name);
    if (!prev) return null;
    return {
      dSta: p.sta - prev.sta,
      dSkill: p.skill - prev.skill,
      dMind: p.mind - prev.mind,
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // StrictMode 下 effect 会跑两次，ref 去重避免一局记两条
    if (recordedRef.current) return;
    recordedRef.current = true;

    saveLocalRecord({ player: p, opp: o, setsP: state.setsP, setsO: state.setsO });

    if (user) {
      saveTennisRecord({
        character: p.name,
        characterFace: p.face,
        opponent: o.name,
        opponentFace: o.face,
        setsWon: state.setsP,
        setsLost: state.setsO,
        reactionMs: p.ms,
        grade: p.grade,
      }).then((res) => {
        if (res.success) {
          toast('🏆 成绩已上传全网榜！');
        } else {
          toast('成绩已存本地，上传全网榜失败');
        }
        onRecorded();
      });
    } else {
      onRecorded();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="screen">
      <div className="card ending-hero">
        <span className="trophy">{ending.icon}</span>
        <h2>{ending.title}</h2>
        <div className="score-line">大比分 {state.setsP} : {state.setsO}（{state.setHistory.join(' / ')}）</div>
        <div className="opp-stats-hint">
          {o.face} {o.name} 属性：体力 {o.sta} · 技巧 {o.skill} · 心态 {o.mind}
        </div>
        {prepGrowthData && (
          <div className="prep-growth-hint">
            较上次备战 {o.name}：
            <span className={prepGrowthData.dSta > 0 ? 'pg-up' : prepGrowthData.dSta < 0 ? 'pg-down' : 'pg-eq'}>
              体力 {prepGrowthData.dSta > 0 ? '+' : ''}{prepGrowthData.dSta}
            </span>
            {' · '}
            <span className={prepGrowthData.dSkill > 0 ? 'pg-up' : prepGrowthData.dSkill < 0 ? 'pg-down' : 'pg-eq'}>
              技巧 {prepGrowthData.dSkill > 0 ? '+' : ''}{prepGrowthData.dSkill}
            </span>
            {' · '}
            <span className={prepGrowthData.dMind > 0 ? 'pg-up' : prepGrowthData.dMind < 0 ? 'pg-down' : 'pg-eq'}>
              心态 {prepGrowthData.dMind > 0 ? '+' : ''}{prepGrowthData.dMind}
            </span>
          </div>
        )}
        {playerWon && winStreak >= 2 && (
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <span className={`ladder-streak${winStreak >= 5 ? ' streak-gold' : winStreak >= 3 ? ' streak-pulse' : ''}`}>
              {winStreak >= 5 ? '🔥🔥🔥' : winStreak >= 3 ? '🔥🔥' : '🔥'} 本次连胜 {winStreak} 场
            </span>
          </div>
        )}
        {!playerWon && lossStreak >= 2 && (
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <span className={`loss-streak-badge${lossStreak >= 4 ? ' loss-streak-fire' : ''}`}>
              {lossStreak >= 4 ? '💪💪' : '💪'} 连败 {lossStreak} 场{lossStreak >= 4 ? '，不倒翁精神！' : lossStreak >= 3 ? '，复仇时刻到了！' : '，换个策略再战！'}
            </span>
          </div>
        )}
        {playerWon && weeklyChampName === p.name && (
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <span className="weekly-champ-badge">🏅 本周家族最强</span>
          </div>
        )}
        <p className="comment">{ending.c}</p>
        <p className="post-match-comment">{postComment}</p>
        <div style={{ marginTop: 22, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={() => dispatch({ type: 'REMATCH' })}>
            ⚡ 再战 {state.opp.face} {state.opp.name}
          </button>
          <button type="button" className="btn ghost" onClick={() => dispatch({ type: 'REPLAY' })}>
            🔁 换对手
          </button>
        </div>
      </div>

      {oppQuote && (
        <div className="card flat char-quote-card">
          <span className="char-quote-who">{o.face} {o.name} 赛后说：</span>
          <p className="char-quote-text">「{oppQuote}」</p>
        </div>
      )}

      {matchStats && (
        <div className="card flat">
          <h2>📊 本局统计</h2>
          <div className="match-stat-grid">
            <div className="ms-item"><span className="ms-val">{matchStats.rallyCount}</span><span className="ms-label">总球数</span></div>
            <div className="ms-item"><span className="ms-val">{matchStats.aces}</span><span className="ms-label">ACE</span></div>
            <div className="ms-item"><span className="ms-val">{matchStats.countersWon}</span><span className="ms-label">克制得分</span></div>
            <div className="ms-item"><span className="ms-val">{matchStats.counterLost ?? 0}</span><span className="ms-label">被克失分</span></div>
            <div className="ms-item"><span className="ms-val">{matchStats.clutchWins}</span><span className="ms-label">关键分胜</span></div>
            {matchStats.mgCount > 0 && (
              <div className="ms-item">
                <span className="ms-val">{(matchStats.mgSum / matchStats.mgCount).toFixed(2)}×</span>
                <span className="ms-label">平均操作倍率</span>
              </div>
            )}
            {matchStats.durationS > 0 && (
              <div className="ms-item"><span className="ms-val">{fmtDuration(matchStats.durationS)}</span><span className="ms-label">局时</span></div>
            )}
            {topMoveEntry && (
              <div className="ms-item">
                <span className="ms-val">×{topMoveEntry[1]}</span>
                <span className="ms-label">王牌：{MOVES[topMoveEntry[0]]?.name ?? topMoveEntry[0]}</span>
              </div>
            )}
          </div>
          {matchStats.countersWon >= 2 && (
            <p className="counter-hl">🎯 本场克制得分 {matchStats.countersWon} 次！</p>
          )}
          {(matchStats.counterLost ?? 0) >= 2 && (matchStats.counterLost ?? 0) > matchStats.countersWon && (
            <p className="counter-lost-warn">🛡 被克 {matchStats.counterLost} 次，对手读招很准，下次注意变换出招节奏</p>
          )}
          {topPlayerMoves.length > 0 && (
            <div className="player-moves-section">
              <div className="player-moves-title">🧠 你本场偏爱</div>
              <div className="opp-moves-row">
                {topPlayerMoves.map(({ moveId, count, name, icon, beatenBy }) => (
                  <div key={moveId} className="player-move-chip">
                    <span className="omc-icon">{icon}</span>
                    <span className="omc-name">{name}</span>
                    <span className="omc-count">×{count}</span>
                    {beatenBy && <span className="pmc-beaten">被克：{beatenBy}</span>}
                  </div>
                ))}
              </div>
              {playerSelfNote && <p className="player-self-note">⚠️ {playerSelfNote}</p>}
            </div>
          )}
          {topOppMoves.length > 0 && (
            <div className="opp-moves-section">
              <div className="opp-moves-title">🔍 对手最常用招式</div>
              <div className="opp-moves-row">
                {topOppMoves.map(({ moveId, count, name, icon, counter }) => (
                  <div key={moveId} className="opp-move-chip">
                    <span className="omc-icon">{icon}</span>
                    <span className="omc-name">{name}</span>
                    <span className="omc-count">×{count}</span>
                    {counter && <span className="omc-counter">克：{counter}</span>}
                  </div>
                ))}
              </div>
              {nextAdvice && <p className="next-advice">💡 {nextAdvice}</p>}
            </div>
          )}
          <p className="next-prep-hint">🏋️ {nextPrepHint}</p>
        </div>
      )}

      <div className="card flat">
        <h2>📡 赛后战报</h2>
        <div className="report">
          <div className="col">
            <div className="who"><span className="face">{p.face}</span>{p.name}（你）</div>
            <dl>
              <dt>天赋</dt><dd>{p.talent}（{p.grade} 级 / {p.ms}ms）</dd>
              <dt>体力</dt><dd>{p.sta}</dd>
              <dt>技巧</dt><dd>{p.skill}</dd>
              <dt>心态</dt><dd>{p.mind}</dd>
            </dl>
          </div>
          <div className="col">
            <div className="who"><span className="face">{o.face}</span>{o.name}（宿敌）</div>
            <dl>
              <dt>体力</dt><dd>{o.sta}</dd>
              <dt>技巧</dt><dd>{o.skill}</dd>
              <dt>心态</dt><dd>{o.mind}</dd>
              <dt>赛后状态</dt><dd>{state.setsP > state.setsO ? '气到转圈' : '狂炫凡尔赛'}</dd>
            </dl>
          </div>
        </div>
      </div>

      <FeedbackWidget
        mode="single"
        character={state.player.name}
        result={state.setsP > state.setsO ? 'win' : 'loss'}
      />

      <div className="card flat">
        <h2>🏆 历史战绩榜</h2>
        <p className="hint">榜单已自动记下这一战 —— 家人们，刷纪录吧！</p>
        <Leaderboard {...boardProps} />
      </div>
    </section>
  );
}
