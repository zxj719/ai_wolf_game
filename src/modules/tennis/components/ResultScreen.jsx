import { useEffect, useRef, useState } from 'react';
import { CHARS, ENDINGS } from '../gameData';
import { saveLocalRecord } from '../localBoard';
import { saveTennisRecord, sendMatchFeedback } from '../../../services/tennisService';
import { Leaderboard } from './Leaderboard';
import { ACHIEVEMENTS, achievementById } from '../meta/achievements';

function AchievementUnlockCard({ newAchievements }) {
  if (!newAchievements || newAchievements.length === 0) return null;
  const items = newAchievements.map((id) => achievementById(id)).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <div className="card flat achieve-unlock-card">
      <h2>🏆 新成就解锁！</h2>
      <div className="achieve-unlock-grid">
        {items.map((a) => (
          <div key={a.id} className="achieve-unlock-item">
            <span className="achieve-icon">{a.icon}</span>
            <div className="achieve-text">
              <span className="achieve-name">{a.name}</span>
              <span className="achieve-desc">{a.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HighlightsCard({ matchStats }) {
  if (!matchStats) return null;
  const { aces, clutchWins, longestWinStreak, maxMgMult, mgCount, mgSum, maxConsecAces } = matchStats;
  const avgMg = mgCount > 0 ? (mgSum / mgCount).toFixed(2) : null;
  const items = [
    { icon: '🎾', label: 'ACE 数', value: aces, badge: aces >= 3 ? 'ACE Master' : null },
    maxConsecAces >= 3 && { icon: '🔥', label: '最长连ACE', value: `×${maxConsecAces}`, badge: '发球炮台' },
    { icon: '⚡', label: 'CLUTCH 成功', value: clutchWins, badge: clutchWins >= 2 ? '压哨王' : null },
    { icon: '📈', label: '最长连胜球', value: longestWinStreak },
    mgCount > 0 && { icon: '🎯', label: '最佳操作倍率', value: maxMgMult.toFixed(2), badge: maxMgMult >= 1.4 ? 'Pro 操作' : null },
    avgMg && { icon: '📊', label: '平均操作倍率', value: avgMg },
  ].filter(Boolean);

  return (
    <div className="card flat hl-card">
      <h2>✨ 本场亮点</h2>
      <div className="hl-grid">
        {items.map((it) => (
          <div key={it.label} className="hl-item">
            <span className="hl-icon">{it.icon}</span>
            <span className="hl-label">{it.label}</span>
            <span className="hl-value">{it.value}</span>
            {it.badge && <span className="hl-badge">{it.badge}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function NextTargetCard({ progress, matchStats }) {
  const locked = ACHIEVEMENTS.filter((a) => !progress.achievements.includes(a.id));
  if (locked.length === 0) {
    return (
      <div className="card flat next-target-card">
        <h2>🏆 全成就达成！</h2>
        <p className="hint">16/16 成就全部解锁，你是真正的家族全能选手！</p>
      </div>
    );
  }

  const charWins = progress.charWins ?? {};
  const charCount = CHARS.filter((c) => (charWins[c.n] ?? 0) >= 1).length;
  const unlockedMoves = progress.unlockedMoves ?? [];
  const aces = matchStats?.aces ?? 0;
  const consec = matchStats?.maxConsecAces ?? 0;
  const streak = matchStats?.longestWinStreak ?? 0;
  const mgMult = matchStats?.maxMgMult ?? 0;

  const scored = locked.map((a) => {
    switch (a.id) {
      case 'firstWin':
        return { ...a, score: 0.95, hint: '赢下你的第一场比赛！' };
      case 'aceMaster':
        return { ...a, score: Math.min(aces / 3, 0.99), hint: `本场 ${aces}/3 ACE，发球连打 🎾 可提高 ACE 概率` };
      case 'consecAce':
        return { ...a, score: Math.min(consec / 3, 0.99), hint: `本场最长连 ACE ${consec}，保持发球节奏！` };
      case 'winStreak5':
        return { ...a, score: Math.min(streak / 5, 0.99), hint: `本场最长连球 ${streak}，找准对手弱点猛攻！` };
      case 'proTouch':
        return { ...a, score: Math.min(mgMult / 1.4, 0.99), hint: `本场最高操作倍率 ${mgMult.toFixed(2)}，小游戏点越准分越高` };
      case 'clutchMaster':
        return { ...a, score: 0.5, hint: '在关键分（Match Point / Break Point）时敢于挑战可触发！' };
      case 'allChars': {
        const unwon = CHARS.filter((c) => (charWins[c.n] ?? 0) === 0);
        const hint = unwon.length > 0
          ? `已用 ${charCount}/7 位家人获胜，下次试试 ${unwon[0].f} ${unwon[0].n}`
          : '即将达成！';
        return { ...a, score: charCount / 7, hint };
      }
      case 'allUltimates':
        return { ...a, score: Math.min(unlockedMoves.length / 7, 0.99), hint: `已解锁 ${unlockedMoves.length}/7 绝技，家族挑战赢对手可解锁新绝技` };
      case 'familyKing':
        return { ...a, score: 0.4, hint: '家族挑战 6 连胜加冕！用单局快打热热身再去挑战' };
      case 'perfectChampion':
        return { ...a, score: 0.25, hint: '家族挑战全程不丢一盘——控制流角色是利器' };
      case 'adventureClear':
        return { ...a, score: 0.35, hint: '奇幻闯关还没通关，家族奖杯等你找回！' };
      case 'firstLegendary':
        return { ...a, score: 0.3, hint: '赢球掉落概率更高，传说装备随时可能出现' };
      case 'boxOpener':
        return { ...a, score: 0.2, hint: '去「网球用品店」开一个盲盒试试' };
      case 'goldRush':
        return { ...a, score: 0.25, hint: '矿工盒单次挖 60+ 分，靠手感爆！' };
      case 'aviator':
        return { ...a, score: 0.3, hint: '「飞翔的网球」小游戏挑战 5 级难度' };
      case 'sGrade':
        return { ...a, score: 0.35, hint: '反应测试摁越快越好，S 级天赋就差临门一脚！' };
      default:
        return { ...a, score: 0.2, hint: a.desc };
    }
  });

  const target = scored.reduce((best, cur) => (cur.score > best.score ? cur : best));

  return (
    <div className="card flat next-target-card">
      <h2>🎯 下一个目标</h2>
      <div className="next-target-body">
        <span className="next-target-icon">{target.icon}</span>
        <div className="next-target-text">
          <span className="next-target-name">{target.name}</span>
          <span className="next-target-hint">{target.hint}</span>
        </div>
      </div>
      <p className="next-target-footer">还有 {locked.length} 个成就待解锁 · 带着目标，下场见！</p>
    </div>
  );
}

/** ⑤ 结局 + 战报 + 双榜。挂载时本地入榜 + 登录用户上传全网榜。 */
export function ResultScreen({ state, dispatch, user, toast, onRecorded, boardProps, matchStats, newAchievements, progress }) {
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

      <AchievementUnlockCard newAchievements={newAchievements} />
      <HighlightsCard matchStats={matchStats} />
      {progress && <NextTargetCard progress={progress} matchStats={matchStats} />}

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
