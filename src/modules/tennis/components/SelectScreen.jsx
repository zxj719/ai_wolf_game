import { useState } from 'react';
import { CHARS } from '../gameData';
import { Leaderboard } from './Leaderboard';

/** ① 报名处：选身份 + 双榜 */
export function SelectScreen({ onStart, toast, boardProps }) {
  const [picked, setPicked] = useState('');

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
          {CHARS.map((c) => (
            <div className="chip" key={c.n}>
              <span className="face">{c.f}</span>
              <span className="nm">{c.n}</span>
            </div>
          ))}
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
