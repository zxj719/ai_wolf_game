import { useEffect, useMemo, useRef } from 'react';
import { ENDINGS, CHAR_QUOTES, rand } from '../gameData';
import { saveLocalRecord, loadLocalRecords } from '../localBoard';
import { saveTennisRecord } from '../../../services/tennisService';
import { Leaderboard } from './Leaderboard';
import { FeedbackWidget } from './FeedbackWidget';

/** ⑤ 结局 + 战报 + 双榜。挂载时本地入榜 + 登录用户上传全网榜。 */
export function ResultScreen({ state, dispatch, user, toast, onRecorded, boardProps }) {
  const ending = ENDINGS[`${state.setsP}-${state.setsO}`];
  const { player: p, opp: o } = state;
  const playerWon = state.setsP > state.setsO;
  const oppQuotePool = CHAR_QUOTES[o.name]?.[playerWon ? 'defeated' : 'victory'];
  const oppQuote = oppQuotePool ? oppQuotePool[rand(0, oppQuotePool.length - 1)] : null;
  const recordedRef = useRef(false);

  // 连胜计算：读取当前游戏保存前的历史记录（effect 尚未运行），加上本局结果
  const winStreak = useMemo(() => {
    const mine = loadLocalRecords().filter((r) => r.p === p.name);
    let streak = playerWon ? 1 : 0;
    for (let i = mine.length - 1; i >= 0 && mine[i].sp > mine[i].so; i--) streak++;
    return streak;
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
        {playerWon && winStreak >= 2 && (
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <span className="ladder-streak">
              {winStreak >= 5 ? '🔥🔥🔥' : winStreak >= 3 ? '🔥🔥' : '🔥'} 本次连胜 {winStreak} 场
            </span>
          </div>
        )}
        <p className="comment">{ending.c}</p>
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
