import { useEffect, useRef, useState } from 'react';
import { ENDINGS } from '../gameData';
import { saveLocalRecord } from '../localBoard';
import { saveTennisRecord, sendMatchFeedback } from '../../../services/tennisService';
import { Leaderboard } from './Leaderboard';

/** ⑤ 结局 + 战报 + 双榜。挂载时本地入榜 + 登录用户上传全网榜。 */
export function ResultScreen({ state, dispatch, user, toast, onRecorded, boardProps }) {
  const ending = ENDINGS[`${state.setsP}-${state.setsO}`];
  const { player: p, opp: o } = state;
  const recordedRef = useRef(false);

  // 记录完成后展示评价区
  const [recordingDone, setRecordingDone] = useState(false);
  const [fbRating, setFbRating] = useState(0);
  const [fbComment, setFbComment] = useState('');
  const [fbDone, setFbDone] = useState(false);

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
        setRecordingDone(true);
      });
    } else {
      onRecorded();
      setRecordingDone(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submitFeedback() {
    sendMatchFeedback({
      rating: fbRating,
      comment: fbComment,
      mode: state.mode,
      character: p.name,
      result: state.setsP > state.setsO ? 'win' : 'loss',
    });
    setFbDone(true);
  }

  return (
    <section className="screen">
      <div className="card ending-hero">
        <span className="trophy">{ending.icon}</span>
        <h2>{ending.title}</h2>
        <div className="score-line">大比分 {state.setsP} : {state.setsO}（{state.setHistory.join(' / ')}）</div>
        <p className="comment">{ending.c}</p>
        <div style={{ marginTop: 22 }}>
          <button type="button" className="btn" onClick={() => dispatch({ type: 'REPLAY' })}>
            🔁 不服！再来一局
          </button>
        </div>
      </div>

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

      <div className="card flat">
        <h2>🏆 历史战绩榜</h2>
        <p className="hint">榜单已自动记下这一战 —— 家人们，刷纪录吧！</p>
        <Leaderboard {...boardProps} />
      </div>

      {recordingDone && (
        <div className="card flat fb-card">
          {fbDone ? (
            <p className="fb-thanks">✅ 感谢你的评价，会帮我们把游戏做得更好！</p>
          ) : (
            <>
              <h2>💬 赛后评价（可跳过）</h2>
              <p className="hint">打完有什么感受？一两句话也行，匿名收集，直接影响下次优化方向。</p>
              <div className="fb-stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`fb-star${fbRating >= n ? ' fb-star--on' : ''}`}
                    onClick={() => setFbRating(n)}
                    aria-label={`${n} 星`}
                  >
                    {fbRating >= n ? '★' : '☆'}
                  </button>
                ))}
                {fbRating > 0 && <span className="fb-rating-label">{['', '差评', '一般', '还行', '不错', '超赞！'][fbRating]}</span>}
              </div>
              <textarea
                className="fb-input"
                placeholder="有什么想说的？（可跳过）"
                maxLength={200}
                rows={2}
                value={fbComment}
                onChange={(e) => setFbComment(e.target.value)}
              />
              <div className="fb-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={fbRating === 0}
                  onClick={submitFeedback}
                >
                  提交评价
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setFbDone(true)}
                >
                  跳过
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
