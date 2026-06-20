import { useState } from 'react';
import { CHARS } from '../gameData';
import { Leaderboard } from './Leaderboard';
import { EQUIPMENT_SLOTS, SLOT_META, RARITY_META } from '../meta/equipment';

/** ① 报名处：选身份 + 双榜 */
export function SelectScreen({ onStart, toast, boardProps, equipment = {} }) {
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
