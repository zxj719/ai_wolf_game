/**
 * LadderScreen.jsx — 家族挑战模式（spec §3）
 *
 * 6 站梯度连战编排：BattleScreen（按站 remount）→ 掉落/金币/绝技解锁入 progress →
 * 赛间三选一（特训/按摩/进店）→ 球王加冕或止步结算。
 * 进度快照存 sessionStorage，中途退出可恢复。
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { BattleScreen } from '../battle/BattleScreen';
import { CHAR_BUILDS, ULTIMATES } from '../battle/moves';
import { CARDS } from '../battle/cards';
import { createLadder, ladderReducer, STAGE_COUNT } from './ladderReducer';
import { applyEquipment, rollDrop, mergeDrop, RARITY_META, SLOT_META } from '../meta/equipment';
import { ShopPanel } from '../meta/ShopPanel';

const SNAPSHOT_KEY = 'tennis_v2_ladder_snapshot';

const LADDER_STARTER_DECK = [
  { cardId: 'towelTime', upgraded: false },
  { cardId: 'newBalls', upgraded: false },
  { cardId: 'coachSign', upgraded: false },
  { cardId: 'deepBreath', upgraded: false },
  { cardId: 'crowdCheer', upgraded: false },
  { cardId: 'mindMassage', upgraded: false },
];

const cardIds = Object.keys(CARDS);
const randomCard = () => ({ cardId: cardIds[Math.floor(Math.random() * cardIds.length)], upgraded: false });

function loadSnapshot() {
  try {
    return JSON.parse(sessionStorage.getItem(SNAPSHOT_KEY));
  } catch {
    return null;
  }
}

function clearSnapshot() {
  try { sessionStorage.removeItem(SNAPSHOT_KEY); } catch { /* noop */ }
}

export function LadderScreen({ basePlayer, progress, onUpdateProgress, equippedUltimate, onExit, toast }) {
  const snapshot = useRef(loadSnapshot()).current;
  const [ladder, dispatchLadder] = useReducer(
    ladderReducer,
    null,
    () => snapshot?.ladder ?? createLadder({ playerName: basePlayer.name, rng: Math.random })
  );
  const [deck, setDeck] = useState(() => snapshot?.deck ?? LADDER_STARTER_DECK);
  const settledRef = useRef(false);

  // 快照：战斗中/赛间持续保存；终局清除
  useEffect(() => {
    if (ladder.status === 'won' || ladder.status === 'lost') {
      clearSnapshot();
      return;
    }
    try {
      sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ ladder, deck }));
    } catch { /* noop */ }
  }, [ladder, deck]);

  const equipBonus = applyEquipment(progress.equipment);
  const opponent = ladder.opponents[Math.min(ladder.stage, STAGE_COUNT - 1)];
  const player = {
    ...basePlayer,
    sta: basePlayer.sta + ladder.bonusStats.sta,
    skill: basePlayer.skill + ladder.bonusStats.skill,
    mind: basePlayer.mind + ladder.bonusStats.mind,
  };

  const handleMatchOver = useCallback(({ score, matchStats, pEnergy }) => {
    const win = score.winner === 0;
    const drop = rollDrop(win ? 'win' : 'loss', Math.random);
    const coins = win ? 50 + ladder.stage * 10 : 15;
    const { equipped, soldFor } = mergeDrop(progress.equipment, drop);

    const unlocked = win
      ? [...new Set([...progress.unlockedMoves,
          ...(Object.entries(ULTIMATES).find(([, u]) => u.owner === opponent.name)?.[0]
            ? [Object.entries(ULTIMATES).find(([, u]) => u.owner === opponent.name)[0]] : [])])]
      : progress.unlockedMoves;

    const achievements = new Set(progress.achievements);
    if (win) achievements.add('firstWin');
    if (drop.rarity === 'legendary') achievements.add('firstLegendary');
    if (matchStats.aces >= 3) achievements.add('aceMaster');

    onUpdateProgress({
      ...progress,
      coins: progress.coins + coins + soldFor,
      equipment: equipped,
      unlockedMoves: unlocked,
      achievements: [...achievements],
    });
    toast(`🎁 掉落：${RARITY_META[drop.rarity].name}${SLOT_META[drop.slot].name} +${coins + soldFor}💰`);

    dispatchLadder(win
      ? { type: 'MATCH_WON', remainingEnergy: pEnergy, drop, coins }
      : { type: 'MATCH_LOST', drop, coins });
  }, [ladder.stage, opponent, progress, onUpdateProgress, toast]);

  // 球王加冕：championships+1 + 成就（一次性）
  useEffect(() => {
    if (ladder.status !== 'won' || settledRef.current) return;
    settledRef.current = true;
    const achievements = new Set([...progress.achievements, 'familyKing']);
    const unlockedAll = new Set([...progress.unlockedMoves, ...ladder.unlockedThisRun]);
    if (unlockedAll.size >= 7) achievements.add('allUltimates');
    onUpdateProgress({
      ...progress,
      championships: progress.championships + 1,
      achievements: [...achievements],
      unlockedMoves: [...unlockedAll],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ladder.status]);

  if (ladder.status === 'fighting') {
    const matchDeck = equipBonus.special.extraCard ? [...deck, randomCard()] : deck;
    return (
      <section className="screen">
        <div className="ladder-bar">
          {ladder.opponents.map((o, i) => (
            <span key={o.name} className={`ladder-pip ${i < ladder.stage ? 'done' : i === ladder.stage ? 'now' : ''}`}>
              {o.face}
            </span>
          ))}
          <span className="ladder-stage">第 {ladder.stage + 1} / {STAGE_COUNT} 站</span>
        </div>
        <BattleScreen
          key={ladder.stage}
          player={player}
          opponent={opponent}
          playerMoves={CHAR_BUILDS[player.name].moves}
          deckInstances={matchDeck}
          ultimate={equippedUltimate}
          equip={equipBonus}
          initialEnergy={ladder.carryEnergy}
          onMatchOver={handleMatchOver}
        />
      </section>
    );
  }

  if (ladder.status === 'between') {
    return (
      <section className="screen">
        <div className="card">
          <h2>🏟️ 第 {ladder.stage + 1} 站拿下！</h2>
          <p className="hint">
            击败 {opponent.face} {opponent.name}，解锁绝技「{ladder.unlockedThisRun[ladder.unlockedThisRun.length - 1]}」！
            下一站对手更强——赛间做点什么？
          </p>
          <div className="opts">
            <button type="button" className="opt" onClick={() => dispatchLadder({ type: 'INTERMISSION', choice: 'train', statRoll: Math.random() })}>
              <span className="key">💪</span><span>加练特训<span className="fx"><em>随机属性 +8</em></span></span>
            </button>
            <button type="button" className="opt" onClick={() => dispatchLadder({ type: 'INTERMISSION', choice: 'massage', statRoll: 0 })}>
              <span className="key">💆</span><span>全身按摩<span className="fx"><em>额外 +30 体力</em></span></span>
            </button>
            <button type="button" className="opt" onClick={() => dispatchLadder({ type: 'INTERMISSION', choice: 'shop', statRoll: 0 })}>
              <span className="key">🛒</span><span>逛网球用品店<span className="fx"><em>购卡 / 升卡 / 购装 / 升装</em></span></span>
            </button>
          </div>
        </div>
        {ladder.pendingShop && (
          <ShopPanel
            progress={progress}
            onUpdateProgress={onUpdateProgress}
            deck={deck}
            onDeckChange={setDeck}
            onClose={() => dispatchLadder({ type: 'SHOP_DONE' })}
            toast={toast}
          />
        )}
      </section>
    );
  }

  // won / lost 结算
  const won = ladder.status === 'won';
  return (
    <section className="screen">
      <div className="card ending-hero">
        <span className="trophy">{won ? '👑' : '🎒'}</span>
        <h2>{won ? '家族球王加冕！' : `止步第 ${ladder.stage + 1} 站`}</h2>
        <p className="comment">
          {won
            ? '六连胜横扫全家！今晚所有人请你吃饭。'
            : `${opponent.face} ${opponent.name} 技高一筹……但战利品都是你的，下次再来！`}
        </p>
        <div className="ladder-loot">
          <div>💰 金币 +{ladder.coinsEarned}</div>
          <div>🎁 装备 ×{ladder.drops.length}</div>
          {ladder.unlockedThisRun.length > 0 && <div>📖 绝技解锁：{ladder.unlockedThisRun.join('、')}</div>}
        </div>
        <div style={{ marginTop: 22, display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button type="button" className="btn" onClick={onExit}>返回报名处</button>
        </div>
      </div>
    </section>
  );
}
