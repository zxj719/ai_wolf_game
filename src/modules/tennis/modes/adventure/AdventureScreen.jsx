/**
 * AdventureScreen.jsx — 奇幻闯关模式（spec §4）
 *
 * 节点地图（每步 1-2 选项）→ 对战（离谱对手 twists）/ 事件（剧情或小游戏）/
 * 商店 / 休息 → BOSS 战 → 夺回奖杯。永久层实时入 progress（失败也保留）。
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { BattleScreen } from '../../battle/BattleScreen';
import { CHAR_BUILDS, MOVES } from '../../battle/moves';
import { CARDS } from '../../battle/cards';
import { MINIGAME_COMPONENTS, SURVIVAL_GAMES, SCORE_GAMES } from '../../battle/minigames';

const ALL_EVENT_GAMES = { ...MINIGAME_COMPONENTS, ...SURVIVAL_GAMES, ...SCORE_GAMES };
import { createAdventure, adventureReducer } from './adventureReducer';
import { ODD_OPPONENTS, FAMILY_CAMEO_TAUNT } from './oddOpponents';
import { pickEvent, rewardTier } from './events';
import { applyEquipment, rollDrop, mergeDrop, RARITY_META, SLOT_META } from '../../meta/equipment';
import { ShopPanel } from '../../meta/ShopPanel';
import { sendMatchTelemetry } from '../../../../services/tennisService';
import { FeedbackWidget } from '../../components/FeedbackWidget';
import { CHARS, rand } from '../../gameData';

const SNAPSHOT_KEY = 'tennis_v2_adventure_snapshot';

const ADVENTURE_STARTER_DECK = [
  { cardId: 'towelTime', upgraded: false },
  { cardId: 'newBalls', upgraded: false },
  { cardId: 'deepBreath', upgraded: false },
  { cardId: 'crowdCheer', upgraded: false },
  { cardId: 'coachSign', upgraded: false },
];

const cardIds = Object.keys(CARDS);
const randomCard = () => ({ cardId: cardIds[Math.floor(Math.random() * cardIds.length)], upgraded: false });

const NODE_META = {
  battle: { icon: '⚔️', name: '对战', desc: '击败对手赢得装备和金币' },
  event: { icon: '❓', name: '奇遇', desc: '随机剧情或小游戏，可得金币 / 装备 / 卡牌' },
  shop: { icon: '🛒', name: '商店', desc: '花💰升级装备或添加卡牌' },
  rest: { icon: '🏕️', name: '营地', desc: '回复 50 点体力' },
};

/** 动态节点描述：结合当前状态给出可操作的奖励预览 */
function getNodeDesc(node, chapterIdx, carryEnergy, tempEnergyMax, coins) {
  const baseCoins = 40 + chapterIdx * 20;
  switch (node.type) {
    case 'battle':
      if (node.boss) return `👑 BOSS！胜出约 +${baseCoins + 100}💰 + 装备`;
      if (node.elite) return `⭐ 精英战，胜出约 +${baseCoins}💰 + 装备`;
      return `胜出约 +${baseCoins}💰 + 随机装备`;
    case 'event':
      return '随机剧情 / 小游戏 → 💰 / 🎁装备 / 🃏卡牌';
    case 'shop':
      return `3 选 1 购卡或装备（当前 ${coins}💰）`;
    case 'rest': {
      const cap = 100 + tempEnergyMax;
      const after = Math.min(cap, Math.round(carryEnergy) + 50);
      return `体力 ${Math.round(carryEnergy)} → ${after} / ${cap}`;
    }
    default:
      return NODE_META[node.type]?.desc ?? '';
  }
}

function loadSnapshot() {
  try { return JSON.parse(sessionStorage.getItem(SNAPSHOT_KEY)); } catch { return null; }
}
function clearSnapshot() {
  try { sessionStorage.removeItem(SNAPSHOT_KEY); } catch { /* noop */ }
}

/** 解析对战节点的对手对象（离谱对手 / 家人客串按章节梯度） */
function resolveOpponent(node, chapterIdx, playerName) {
  if (node.opponentId !== 'family') {
    return ODD_OPPONENTS[node.opponentId];
  }
  const pool = CHARS.filter((c) => c.n !== playerName);
  const c = pool[rand(0, pool.length - 1)];
  const lo = 45 + chapterIdx * 15;
  return {
    name: c.n, face: c.f,
    sta: rand(lo, lo + 12), skill: rand(lo, lo + 12), mind: rand(lo, lo + 12),
    taunt: FAMILY_CAMEO_TAUNT,
    twists: {},
  };
}

export function AdventureScreen({ basePlayer, progress, onUpdateProgress, equippedUltimate, onExit, toast }) {
  const snapshot = useRef(loadSnapshot()).current;
  const [run, dispatchRun] = useReducer(
    adventureReducer,
    null,
    () => snapshot?.run ?? createAdventure({ rng: Math.random })
  );
  const [deck, setDeck] = useState(
    () => snapshot?.deck ?? [...ADVENTURE_STARTER_DECK, ...(progress.ownedCards ?? [])]
  );
  const [battleOpponent, setBattleOpponent] = useState(null);
  const settledRef = useRef(false);

  useEffect(() => {
    if (run.phase === 'victory' || run.phase === 'failed') { clearSnapshot(); return; }
    try { sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ run, deck })); } catch { /* noop */ }
  }, [run, deck]);

  // 通关结算（一次性）：adventure_clears+1 + 成就
  useEffect(() => {
    if (run.phase !== 'victory' || settledRef.current) return;
    settledRef.current = true;
    onUpdateProgress({
      ...progress,
      adventureClears: progress.adventureClears + 1,
      achievements: [...new Set([...progress.achievements, 'adventureClear'])],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.phase]);

  const equipBonus = applyEquipment(progress.equipment);
  const chapter = run.map.chapters[Math.min(run.chapterIdx, 2)];
  const player = {
    ...basePlayer,
    sta: basePlayer.sta + run.runStats.sta,
    skill: basePlayer.skill + run.runStats.skill,
    mind: basePlayer.mind + run.runStats.mind,
  };
  const adventureEquip = { ...equipBonus, energyMax: equipBonus.energyMax + run.tempEnergyMax };

  const handleBattleOver = useCallback(({ score, matchStats, pEnergy, durationS }) => {
    const win = score.winner === 0;
    sendMatchTelemetry({
      mode: 'adventure', character: basePlayer.name, opponent: battleOpponent?.name ?? 'unknown',
      score, matchStats, durationS,
    });
    const drop = rollDrop(win ? 'win' : 'loss', Math.random);
    const coins = win ? 40 + run.chapterIdx * 20 + (run.currentNode?.boss ? 100 : 0) : 15;
    const { equipped, soldFor } = mergeDrop(progress.equipment, drop);
    const achievements = new Set(progress.achievements);
    if (win) achievements.add('firstWin');
    if (drop.rarity === 'legendary') achievements.add('firstLegendary');
    if (matchStats.aces >= 3) achievements.add('aceMaster');
    if (matchStats.clutchWins > 0) achievements.add('clutchMaster');
    onUpdateProgress({
      ...progress,
      coins: progress.coins + coins + soldFor,
      equipment: equipped,
      achievements: [...achievements],
    });
    toast(`🎁 ${RARITY_META[drop.rarity].name}${SLOT_META[drop.slot].name} +${coins + soldFor}💰`);
    setBattleOpponent(null);
    dispatchRun({ type: 'BATTLE_RESULT', win, remainingEnergy: pEnergy, drop, coins });
  }, [run.chapterIdx, run.currentNode, progress, onUpdateProgress, toast, basePlayer.name, battleOpponent]);

  /** 事件奖励：永久部分入 progress，run 部分交 reducer */
  const settleEventReward = useCallback((reward, flavor) => {
    let next = { ...progress };
    let changed = false;
    if (reward.cost) { next.coins -= reward.cost; changed = true; }
    if (reward.kind === 'coins') { next.coins += reward.amount; changed = true; }
    if (reward.kind === 'gear') {
      const drop = rollDrop('event', Math.random);
      const { equipped, soldFor } = mergeDrop(next.equipment, drop);
      next = { ...next, equipment: equipped, coins: next.coins + soldFor };
      changed = true;
      toast(`🎁 获得${RARITY_META[drop.rarity].name}${SLOT_META[drop.slot].name}！`);
    }
    if (reward.kind === 'card') {
      const card = randomCard();
      setDeck((d) => [...d, card]);
      toast(`🃏 牌库 +「${CARDS[card.cardId].name}」`);
    }
    if (changed) onUpdateProgress(next);
    if (flavor) toast(flavor);
    dispatchRun({ type: 'EVENT_DONE', reward, statRoll: Math.random() });
  }, [progress, onUpdateProgress, toast]);

  // ===== 终局屏 =====
  if (run.phase === 'victory' || run.phase === 'failed') {
    const won = run.phase === 'victory';
    return (
      <section className="screen">
        <div className="card ending-hero">
          <span className="trophy">{won ? '🏆' : '🎒'}</span>
          <h2>{won ? '奖杯夺回！' : '闯关失败……'}</h2>
          <p className="comment">
            {won
              ? '从菜市场打到太空站，离谱小游戏练出的每一分反应、心态和体能，都在最后这场正经网球对决里派上了用场。家族奖杯，完璧归赵！'
              : '这一路的装备和金币都揣进了口袋——养成不会清零，装备升满再来！'}
          </p>
          <div className="ladder-loot">
            <div>💰 +{run.coinsEarned}</div>
            <div>🎁 装备 ×{run.drops.length}</div>
            <div>📍 止步：{chapter.title}</div>
          </div>
          <div style={{ marginTop: 22 }}>
            <button type="button" className="btn" onClick={onExit}>返回报名处</button>
          </div>
        </div>
        <FeedbackWidget
          mode="adventure"
          character={basePlayer.name}
          result={won ? 'win' : 'loss'}
        />
      </section>
    );
  }

  // ===== 节点执行 =====
  if (run.phase === 'node' && run.currentNode) {
    const node = run.currentNode;

    if (node.type === 'battle') {
      const opponent = battleOpponent ?? resolveOpponent(node, run.chapterIdx, player.name);
      if (!battleOpponent) setBattleOpponent(opponent);
      return (
        <section className="screen">
          <div className="adv-banner">
            {chapter.title} · {node.boss ? '👑 最终 BOSS' : node.elite ? '⭐ 精英战' : '⚔️ 遭遇战'}
            <small>第 {run.stepIdx + 1} / {chapter.steps.length} 步 · 第 {run.chapterIdx + 1} / {run.map.chapters.length} 章</small>
          </div>
          <div className="bt-tell">{opponent.face} {opponent.taunt}{opponent.twistDesc ? <small>（{opponent.twistDesc}）</small> : null}</div>
          <BattleScreen
            key={`${run.chapterIdx}-${run.stepIdx}`}
            player={player}
            opponent={opponent}
            playerMoves={CHAR_BUILDS[player.name].moves}
            deckInstances={equipBonus.special.extraCard ? [...deck, randomCard()] : deck}
            ultimate={equippedUltimate}
            equip={adventureEquip}
            initialEnergy={run.carryEnergy}
            twists={opponent.twists ?? {}}
            onMatchOver={handleBattleOver}
          />
        </section>
      );
    }

    if (node.type === 'event') {
      const event = pickEvent(run.chapterIdx + 1, node.eventRoll ?? 0.5);
      if (event.type === 'story') {
        return (
          <section className="screen">
            <div className="card">
              <h2>{event.icon} {event.title}</h2>
              <p className="hint">{event.text}</p>
              <div className="opts">
                {event.options.map((o, i) => (
                  <button key={o.label} type="button" className="opt"
                    onClick={() => settleEventReward(o.reward, o.reward.flavor)}>
                    <span className="key">{'AB'[i]}</span>
                    <span>{o.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        );
      }
      const Minigame = ALL_EVENT_GAMES[event.minigame];
      return (
        <section className="screen">
          <div className="card">
            <h2>{event.icon} {event.title}</h2>
            <p className="hint">{event.text}</p>
            <Minigame
              onDone={(m) => {
                const reward = event.rewards[rewardTier(m)];
                settleEventReward(reward, reward.flavor);
              }}
              timeScale={1}
              windowBonus={0}
            />
          </div>
        </section>
      );
    }

    if (node.type === 'shop') {
      return (
        <section className="screen">
          <ShopPanel
            progress={progress}
            onUpdateProgress={onUpdateProgress}
            deck={deck}
            onDeckChange={setDeck}
            onClose={() => dispatchRun({ type: 'SHOP_DONE' })}
            toast={toast}
          />
        </section>
      );
    }

    // rest
    return (
      <section className="screen">
        <div className="card">
          <h2>🏕️ 营地</h2>
          <p className="hint">篝火噼啪作响。歇一会儿吧，前面的路还长。</p>
          <div className="center">
            <button type="button" className="btn" onClick={() => { toast('体力 +50 🔥'); dispatchRun({ type: 'REST' }); }}>
              休息（体力 +50）→
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ===== 选路（pick） =====
  const step = chapter.steps[run.stepIdx];
  return (
    <section className="screen">
      <div className="adv-banner">
        {chapter.title}
        <small>第 {run.stepIdx + 1} / {chapter.steps.length} 步 · 第 {run.chapterIdx + 1} / {run.map.chapters.length} 章</small>
      </div>
      <div className="adv-map">
        {chapter.steps.map((st, si) => (
          <div key={si} className={`adv-step ${si < run.stepIdx ? 'done' : si === run.stepIdx ? 'now' : ''}`}>
            {st.map((n) => (
            <span
              key={n.id}
              className="adv-node"
              title={`${NODE_META[n.type].name}：${NODE_META[n.type].desc}`}
            >
              {NODE_META[n.type].icon}
            </span>
          ))}
          </div>
        ))}
      </div>
      <div className="card">
        <h2>🗺️ 选择去向</h2>
        <p className="hint">
          体力 {Math.round(run.carryEnergy)}/{100 + run.tempEnergyMax} ·
          加点 💪{run.runStats.sta} 🎯{run.runStats.skill} 🧘{run.runStats.mind} · 💰{progress.coins}
        </p>
        <div className="opts">
          {step.map((node, i) => (
            <button key={node.id} type="button" className="opt"
              onClick={() => dispatchRun({ type: 'CHOOSE_NODE', optionIdx: i })}>
              <span className="key">{NODE_META[node.type].icon}</span>
              <span>
                {NODE_META[node.type].name}
                {node.type === 'battle' && (
                  <span className="fx"><em>
                    {node.elite ? (node.boss ? '👑 网球之神' : `⭐ ${node.opponentId}`)
                      : node.opponentId === 'family' ? '神秘的家人' : node.opponentId}
                  </em></span>
                )}
                <small className="adv-node-desc">{getNodeDesc(node, run.chapterIdx, run.carryEnergy, run.tempEnergyMax, progress.coins)}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
