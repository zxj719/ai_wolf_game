import { useState } from 'react';

const ONBOARDING_KEY = 'tennis_onboarding_v1';

export function checkOnboardingSeen() {
  return !!localStorage.getItem(ONBOARDING_KEY);
}

export function markOnboardingSeen() {
  localStorage.setItem(ONBOARDING_KEY, '1');
}

export const TABS = [
  { id: 'counter', label: '⚡ 克制表' },
  { id: 'energy', label: '💪 体力规则' },
  { id: 'tell', label: '🔍 读招技巧' },
  { id: 'modes', label: '🎮 游戏模式' },
];

function CounterTab() {
  return (
    <div className="ob-section">
      <p className="ob-lead">招式之间存在克制关系：克中时威力 <b>×1.5</b>，被克时只有 <b>×0.7</b>。</p>

      <div className="ob-cycle">
        <div className="ob-cycle-title">核心四循环</div>
        <div className="ob-cycle-chain">
          <span className="ob-move power">重炮平击</span>
          <span className="ob-arrow">→克→</span>
          <span className="ob-move spin">切削放缓</span>
          <span className="ob-arrow">→克→</span>
          <span className="ob-move spin">上旋抽击</span>
          <span className="ob-arrow">→克→</span>
          <span className="ob-move ctrl">放小球</span>
          <span className="ob-arrow">→克→</span>
          <span className="ob-move power">重炮平击</span>
        </div>
      </div>

      <div className="ob-cycle">
        <div className="ob-cycle-title">网前组</div>
        <div className="ob-net-grid">
          <div className="ob-pair"><span className="ob-move net">穿越球</span><span className="ob-arrow-sm">→克→</span><span className="ob-move net">网前截击</span></div>
          <div className="ob-pair"><span className="ob-move ctrl">挑高球</span><span className="ob-arrow-sm">→克→</span><span className="ob-move net">网前截击</span></div>
          <div className="ob-pair"><span className="ob-move power">高压扣杀</span><span className="ob-arrow-sm">→克→</span><span className="ob-move ctrl">挑高球</span></div>
          <div className="ob-pair"><span className="ob-move net">网前截击</span><span className="ob-arrow-sm">→克→</span><span className="ob-move ctrl">放小球</span>/<span className="ob-move spin">切削</span></div>
        </div>
      </div>

      <div className="ob-tip">💡 打出克制时屏幕会显示「效果拔群」，被克时显示「被压制」。看日志学对手流派！</div>
    </div>
  );
}

function EnergyTab() {
  return (
    <div className="ob-section">
      <p className="ob-lead">体力是全场的核心资源——每球消耗，影响招式威力。</p>

      <div className="ob-energy-levels">
        <div className="ob-energy-row ob-fresh">
          <span className="ob-e-badge">充沛</span>
          <span className="ob-e-range">体力 ≥ 50</span>
          <span className="ob-e-effect">威力全效 ×1.0</span>
        </div>
        <div className="ob-energy-row ob-tired">
          <span className="ob-e-badge">疲惫</span>
          <span className="ob-e-range">体力 20–49</span>
          <span className="ob-e-effect">威力打折 ×0.85</span>
        </div>
        <div className="ob-energy-row ob-exhaust">
          <span className="ob-e-badge">力竭</span>
          <span className="ob-e-range">体力 &lt; 20</span>
          <span className="ob-e-effect">威力大减 ×0.70</span>
        </div>
      </div>

      <div className="ob-restore-box">
        <div className="ob-restore-title">🔋 回体方式</div>
        <ul className="ob-restore-list">
          <li><b>🌀 切削放缓</b>：打出即<b>回 10 体力</b>（是的，它是负消耗）</li>
          <li><b>🏁 赢得一局</b>：双方回体 <b>20</b>（打完一盘加 50）</li>
          <li><b>🃏 卡牌</b>：「第二口气」「运动饮料」等牌可应急回血</li>
        </ul>
      </div>

      <div className="ob-tip">💡 体力低时切削既保命又回体，别只想着打重炮！</div>
    </div>
  );
}

function TellTab() {
  return (
    <div className="ob-section">
      <p className="ob-lead">比赛中对手会露出行动提示（准确率约 <b>75%</b>）。</p>

      <div className="ob-tell-demo">
        <div className="ob-tell-bubble">
          <span className="ob-tell-icon">👁</span>
          <span>对手似乎要打 <b>「切削放缓」</b></span>
        </div>
        <div className="ob-tell-arrow">↓ 看到这个提示时</div>
        <div className="ob-tell-action">
          选 <b>「重炮平击」</b> → 克制切削 → 威力 ×1.5！
        </div>
      </div>

      <div className="ob-tell-steps">
        <div className="ob-step">
          <span className="ob-step-n">1</span>
          <span>查看底部红色提示文字（对手当前意图）</span>
        </div>
        <div className="ob-step">
          <span className="ob-step-n">2</span>
          <span>在克制表中找能克制该招的招式</span>
        </div>
        <div className="ob-step">
          <span className="ob-step-n">3</span>
          <span>若体力不足，至少选一招不被对手克制的</span>
        </div>
      </div>

      <div className="ob-tip">💡 提示有 25% 概率是假动作——高手会在关键分偶尔反读！</div>
    </div>
  );
}

function ModesTab() {
  return (
    <div className="ob-section">
      <p className="ob-lead">四种模式随心选，适合不同时间和心情。</p>

      <div className="ob-mode-list">
        <div className="ob-mode-row">
          <span className="ob-mode-icon">⚡</span>
          <div className="ob-mode-body">
            <div className="ob-mode-name">单局快打</div>
            <div className="ob-mode-desc">三盘两胜制，战绩上全球榜。随时可打，5–10 分钟决出胜负。</div>
          </div>
        </div>

        <div className="ob-mode-row">
          <span className="ob-mode-icon">🏆</span>
          <div className="ob-mode-body">
            <div className="ob-mode-name">家族挑战</div>
            <div className="ob-mode-desc">6 位对手梯度连战，输一场止步。击败全员加冕球王，过关可解锁绝技。</div>
          </div>
        </div>

        <div className="ob-mode-row">
          <span className="ob-mode-icon">🗺️</span>
          <div className="ob-mode-body">
            <div className="ob-mode-name">奇幻闯关</div>
            <div className="ob-mode-desc">穿越菜市场／修仙界／太空站夺回家族奖杯！剧情奇遇 + 装备掉落，失败也保留进度。</div>
          </div>
        </div>

        <div className="ob-mode-row ob-mode-row--sprint">
          <span className="ob-mode-icon">⏱️</span>
          <div className="ob-mode-body">
            <div className="ob-mode-name">限时冲刺</div>
            <div className="ob-mode-desc">15 分钟内尽量多赢！随机对手，胜 <b>+3</b> 分，负 <b>+1</b> 分（参与即得）。碎片时间首选。</div>
            <div className="ob-mode-ranks">
              <span>🏆 ≥30 传说冲分王</span>
              <span>🥈 ≥18 进阶冲刺手</span>
              <span>🥉 ≥9 坚持就是胜利</span>
            </div>
          </div>
        </div>
      </div>

      <div className="ob-tip">💡 碎片时间选「限时冲刺」，专心挑战选「家族挑战」，剧情冒险选「奇幻闯关」！</div>
    </div>
  );
}

const TAB_CONTENT = { counter: CounterTab, energy: EnergyTab, tell: TellTab, modes: ModesTab };

export function OnboardingModal({ onClose }) {
  const [tab, setTab] = useState('tell');
  const Content = TAB_CONTENT[tab];

  const handleClose = () => {
    markOnboardingSeen();
    onClose();
  };

  return (
    <div className="ob-overlay" role="dialog" aria-modal="true" aria-label="游戏指南">
      <div className="ob-modal">
        <div className="ob-header">
          <h2 className="ob-title">🎾 快速上手指南</h2>
          <button type="button" className="ob-close" onClick={handleClose} aria-label="关闭">✕</button>
        </div>

        <div className="ob-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`ob-tab ${tab === t.id ? 'ob-tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="ob-body" role="tabpanel">
          <Content />
        </div>

        <div className="ob-footer">
          <button type="button" className="btn" onClick={handleClose}>
            明白了，开始比赛！🎾
          </button>
          <p className="ob-hint-small">之后随时点击右上角 <b>?</b> 查阅</p>
        </div>
      </div>
    </div>
  );
}
