/**
 * LadderScreen.jsx — 家族挑战模式（spec §3）
 *
 * 6 站梯度连战编排：BattleScreen（按站 remount）→ 掉落/金币/绝技解锁入 progress →
 * 赛间三选一（特训/按摩/进店）→ 球王加冕或止步结算。
 * 进度快照存 sessionStorage，中途退出可恢复。
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { BattleScreen } from '../battle/BattleScreen';
import { CHAR_BUILDS, ULTIMATES, MOVES } from '../battle/moves';
import { CARDS } from '../battle/cards';
import { createLadder, ladderReducer, STAGE_COUNT } from './ladderReducer';
import { applyEquipment, rollDrop, mergeDrop, RARITY_META, SLOT_META } from '../meta/equipment';
import { ShopPanel } from '../meta/ShopPanel';
import { FeedbackWidget } from '../components/FeedbackWidget';
import { sendMatchTelemetry } from '../../../services/tennisService';
import { incrementNoviceGames } from '../meta/noviceTracker';
import { loadLocalRecords } from '../localBoard';

const SNAPSHOT_KEY = 'tennis_v2_ladder_snapshot';

function getBetweenAdvice(winRate, historyCount) {
  if (historyCount === 0) return '💡 首次对阵，建议加练摸清套路';
  const pct = Math.round(winRate * 100);
  if (winRate < 0.3) return `💡 胜率仅 ${pct}%，强烈建议特训冲刺！`;
  if (winRate >= 0.7) return `💡 胜率 ${pct}%，状态不错，随便选都行`;
  return `💡 胜率 ${pct}%，特训或逛店补装备皆可`;
}

function getIntermissionHints(ladder) {
  const { lastRemainingEnergy, bonusStats, stage } = ladder;
  const energyBase = Math.min(100, lastRemainingEnergy + 40);
  const energyMassage = Math.min(100, lastRemainingEnergy + 40 + 30);
  const massageDelta = energyMassage - energyBase;
  const totalBonus = bonusStats.sta + bonusStats.skill + bonusStats.mind;
  const stagesLeft = STAGE_COUNT - 1 - stage;

  let trainHint;
  if (stagesLeft >= 4) trainHint = `还剩 ${stagesLeft} 站，加练效益最高`;
  else if (stagesLeft === 1) trainHint = '最后一站，属性直接影响决赛';
  else trainHint = totalBonus < 16 ? `加成仅 +${totalBonus}，现在加练收益高` : `当前加成 +${totalBonus}，看情况`;

  let massageHint;
  if (massageDelta <= 5) massageHint = `体力 ${energyBase}%，按摩仅 +${massageDelta}%，收益低`;
  else if (energyBase < 55) massageHint = `体力仅 ${energyBase}%，按摩→${energyMassage}%，推荐`;
  else massageHint = `体力 ${energyBase}%→${energyMassage}%，中等收益`;

  let shopHint;
  if (stagesLeft >= 4) shopHint = `还有 ${stagesLeft} 站，装备早买早收益`;
  else if (stagesLeft === 1) shopHint = '最后一次备战，有用就买';
  else shopHint = '灵活选择，升卡最划算';

  const massageRecommended = massageDelta > 5 && energyBase < 55;
  return { trainHint, massageHint, shopHint, massageRecommended };
}

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
  const [deck, setDeck] = useState(
    () => snapshot?.deck ?? [...LADDER_STARTER_DECK, ...(progress.ownedCards ?? [])]
  );
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

  // 下一站对手（仅 between 状态有效；between 时 stage 尚未递增，stage+1 即下一站索引）
  const nextOppForBetween = ladder.status === 'between' ? ladder.opponents[ladder.stage + 1] : null;
  const vsNextHistory = nextOppForBetween
    ? loadLocalRecords().filter((r) => r.p === basePlayer.name && r.o === nextOppForBetween.name)
    : [];
  const vsNextWins = vsNextHistory.filter((r) => r.sp > r.so).length;
  const vsNextWinRate = vsNextHistory.length > 0 ? vsNextWins / vsNextHistory.length : null;

  const player = {
    ...basePlayer,
    sta: basePlayer.sta + ladder.bonusStats.sta,
    skill: basePlayer.skill + ladder.bonusStats.skill,
    mind: basePlayer.mind + ladder.bonusStats.mind,
  };

  const handleMatchOver = useCallback(({ score, matchStats, pEnergy, durationS }) => {
    const win = score.winner === 0;
    incrementNoviceGames();
    sendMatchTelemetry({
      mode: 'ladder', character: basePlayer.name, opponent: opponent.name,
      score, matchStats, durationS,
    });
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
    if (matchStats.clutchWins > 0) achievements.add('clutchMaster');

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
  }, [ladder.stage, opponent, progress, onUpdateProgress, toast, basePlayer.name]);

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
          {ladder.stage > 0 && <span className="ladder-streak">🔥 {ladder.stage}连胜</span>}
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
    const hints = getIntermissionHints(ladder);
    return (
      <section className="screen">
        <div className="card">
          <h2>🏟️ 第 {ladder.stage + 1} 站拿下！{' '}<span className="ladder-streak">🔥 {ladder.stage + 1}连胜</span></h2>
          <p className="hint">
            击败 {opponent.face} {opponent.name}，解锁绝技「{ladder.unlockedThisRun[ladder.unlockedThisRun.length - 1]}」！
            下一站对手更强——赛间做点什么？
          </p>
          {nextOppForBetween && (
            <>
              <p className="hint">
                🔮 下一站：{nextOppForBetween.face} {nextOppForBetween.name}
                {vsNextHistory.length > 0
                  ? `，历史 ${vsNextHistory.length} 战 ${vsNextWins} 胜 ${vsNextHistory.length - vsNextWins} 负`
                  : '，首次对阵'}
              </p>
              {CHAR_BUILDS[nextOppForBetween.name] && (
                <p className="hint opp-style-preview">
                  ⚔️ {CHAR_BUILDS[nextOppForBetween.name].style}：{CHAR_BUILDS[nextOppForBetween.name].moves.map(m => MOVES[m]?.name ?? m).join(' / ')}
                </p>
              )}
              <p className="hint between-suggest" style={{ marginBottom: 14 }}>
                {getBetweenAdvice(vsNextWinRate, vsNextHistory.length)}
              </p>
            </>
          )}
          <div className="opts">
            <button type="button" className="opt" onClick={() => dispatchLadder({ type: 'INTERMISSION', choice: 'train', statRoll: Math.random() })}>
              <span className="key">💪</span><span>加练特训<span className="fx"><em>随机属性 +8</em></span><span className="opt-hint">{hints.trainHint}</span></span>
            </button>
            <button type="button" className="opt" onClick={() => dispatchLadder({ type: 'INTERMISSION', choice: 'massage', statRoll: 0 })}>
              <span className="key">💆</span><span>全身按摩<span className="fx"><em>额外 +30 体力</em></span><span className={`opt-hint${hints.massageRecommended ? ' opt-hint-hi' : ''}`}>{hints.massageHint}</span></span>
            </button>
            <button type="button" className="opt" onClick={() => dispatchLadder({ type: 'INTERMISSION', choice: 'shop', statRoll: 0 })}>
              <span className="key">🛒</span><span>逛网球用品店<span className="fx"><em>购卡 / 升卡 / 购装 / 升装</em></span><span className="opt-hint">{hints.shopHint}</span></span>
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
      <FeedbackWidget
        mode="ladder"
        character={basePlayer.name}
        result={won ? 'win' : 'loss'}
      />
    </section>
  );
}
