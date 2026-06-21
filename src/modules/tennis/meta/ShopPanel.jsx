/**
 * ShopPanel.jsx — 商店五项服务（spec §2.1/§4.2）：
 * 购卡 3 选 1 / 卡牌升级 / 购装 3 件 / 装备品质升级 / 移除卡牌。
 * B 段用于家族挑战赛间，C 段复用为闯关商店节点。
 * 金币与装备走 progress（onUpdateProgress 由调用方持久化），卡牌走单局 deck。
 */

import { useState } from 'react';
import { CARDS } from '../battle/cards';
import { FlappyBall, DodgeRain, GoldMiner } from '../battle/minigames';
import { getLevel } from '../battle/minigames/levels';
import {
  rollDrop, mergeDrop, upgradeCost, nextRarity, sellValue,
  SLOT_META, RARITY_META, EQUIPMENT_SLOTS, RARITIES,
} from './equipment';

const CARD_PRICE = 40;
const CARD_UPGRADE_PRICE = 30;
const CARD_REMOVE_PRICE = 25;
const GEAR_PRICE = { common: 30, fine: 60, epic: 140, legendary: 320 };

const cardIds = Object.keys(CARDS);
const randomCardId = () => cardIds[Math.floor(Math.random() * cardIds.length)];

/** 盲盒定义（spec §7b）：坚持类过关开好货，刷分类分数直接变金币 */
const BOXES = [
  { id: 'wood', icon: '📦', name: '木盒', price: 50, kind: 'survival', levelBonus: 0,
    desc: '坚持 10s：开出精良+装备和 1 张卡；失败保底普通装备' },
  { id: 'gold', icon: '🎁', name: '金盒', price: 120, kind: 'survival', levelBonus: 2,
    desc: '高难起步！过关开史诗+装备和强化卡；失败保底精良' },
  { id: 'miner', icon: '⛏️', name: '矿工盒', price: 80, kind: 'score',
    desc: '15s 黄金球工：分数 1:1 变金币，60 分加送装备——技术好能回本' },
];

/** 把掉落品质抬到至少 minRarity */
function rollGearAtLeast(minRarity) {
  const drop = rollDrop('win', Math.random);
  const min = RARITIES.indexOf(minRarity);
  if (RARITIES.indexOf(drop.rarity) < min) drop.rarity = RARITIES[min];
  return drop;
}

function gearLabel(item, slot) {
  return `${RARITY_META[item.rarity].name}${SLOT_META[slot].name}`;
}

/**
 * @param deckCap 收藏模式（模式页商店）传 10：购卡进永久收藏，满了拒买/折现
 * @param deckLabel 牌区标题（'本局牌库' / '永久收藏'）
 */
export function ShopPanel({ progress, onUpdateProgress, deck, onDeckChange, onClose, toast, deckCap = null, deckLabel = '本局牌库' }) {
  const [cardOffers, setCardOffers] = useState(() => [randomCardId(), randomCardId(), randomCardId()]);
  const [gearOffers, setGearOffers] = useState(() => [
    rollDrop('event', Math.random), rollDrop('event', Math.random), rollDrop('event', Math.random),
  ]);
  const [openingBox, setOpeningBox] = useState(null);   // {box, Game}
  const coins = progress.coins;

  const buyBox = (box) => {
    if (coins < box.price) { toast('金币不够！'); return; }
    const Game = box.kind === 'score'
      ? GoldMiner
      : (Math.random() < 0.5 ? FlappyBall : DodgeRain);
    onUpdateProgress({ ...progress, coins: coins - box.price });
    setOpeningBox({ box, Game });
  };

  const settleBox = (box) => (m, extra) => {
    setOpeningBox(null);
    // buyBox 时已扣盒价，此处闭包拿到的是扣价后的最新 progress
    let next = { ...progress };
    const achievements = new Set(next.achievements);
    achievements.add('boxOpener');
    if (getLevel('flappy') >= 5) achievements.add('aviator');

    if (box.kind === 'score') {
      const score = extra?.score ?? 0;
      next.coins += score;
      let msg = `⛏️ 挖到 ${score} 金币！`;
      if (score >= 60) {
        achievements.add('goldRush');
        const gear = rollGearAtLeast('fine');
        const { equipped, soldFor } = mergeDrop(next.equipment, gear);
        next = { ...next, equipment: equipped, coins: next.coins + soldFor };
        msg += ` 满载而归，加送${RARITY_META[gear.rarity].name}${SLOT_META[gear.slot].name}！`;
      }
      toast(msg);
    } else {
      const passed = !!extra?.passed;
      const gear = rollGearAtLeast(passed
        ? (box.id === 'gold' ? 'epic' : 'fine')
        : (box.id === 'gold' ? 'fine' : 'common'));
      const { equipped, soldFor } = mergeDrop(next.equipment, gear);
      next = { ...next, equipment: equipped, coins: next.coins + soldFor };
      if (passed) {
        if (deckCap && deck.length >= deckCap) {
          next.coins += 20;    // 收藏满：卡牌折现
        } else {
          onDeckChange([...deck, { cardId: randomCardId(), upgraded: box.id === 'gold' }]);
        }
      }
      toast(passed
        ? `🎉 盒开了！${RARITY_META[gear.rarity].name}${SLOT_META[gear.slot].name} + 1 张${box.id === 'gold' ? '强化' : ''}卡`
        : `📦 没撑住……保底${RARITY_META[gear.rarity].name}${SLOT_META[gear.slot].name}`);
    }
    onUpdateProgress({ ...next, achievements: [...achievements] });
  };

  const spend = (amount) => {
    onUpdateProgress({ ...progress, coins: coins - amount });
  };

  const buyCard = (i) => {
    if (coins < CARD_PRICE) { toast('金币不够！'); return; }
    if (deckCap && deck.length >= deckCap) { toast(`收藏已满（${deckCap} 张），先移除几张吧`); return; }
    onDeckChange([...deck, { cardId: cardOffers[i], upgraded: false }]);
    setCardOffers(cardOffers.map((c, j) => (j === i ? null : c)));
    spend(CARD_PRICE);
    toast(`已购入「${CARDS[cardOffers[i]].name}」`);
  };

  const upgradeCard = (idx) => {
    if (coins < CARD_UPGRADE_PRICE) { toast('金币不够！'); return; }
    onDeckChange(deck.map((c, j) => (j === idx ? { ...c, upgraded: true } : c)));
    spend(CARD_UPGRADE_PRICE);
    toast(`「${CARDS[deck[idx].cardId].name}」已强化为 + 版！`);
  };

  const removeCard = (idx) => {
    if (coins < CARD_REMOVE_PRICE) { toast('金币不够！'); return; }
    onDeckChange(deck.filter((_, j) => j !== idx));
    spend(CARD_REMOVE_PRICE);
    toast('已瘦身牌库');
  };

  const buyGear = (i) => {
    const drop = gearOffers[i];
    const price = GEAR_PRICE[drop.rarity];
    if (coins < price) { toast('金币不够！'); return; }
    const { equipped, soldFor } = mergeDrop(progress.equipment, drop);
    onUpdateProgress({ ...progress, equipment: equipped, coins: coins - price + soldFor });
    setGearOffers(gearOffers.map((g, j) => (j === i ? null : g)));
    toast(soldFor > 0 ? `已入手（旧件折现 +${soldFor}💰）` : `已装备 ${gearLabel(drop, drop.slot)}！`);
  };

  const upgradeGear = (slot) => {
    const item = progress.equipment[slot];
    const cost = upgradeCost(item.rarity);
    if (cost == null) return;
    if (coins < cost) { toast('金币不够！'); return; }
    const upgraded = { ...item, rarity: nextRarity(item.rarity) };
    onUpdateProgress({
      ...progress,
      equipment: { ...progress.equipment, [slot]: upgraded },
      coins: coins - cost,
    });
    toast(`${SLOT_META[slot].name}升级为${RARITY_META[upgraded.rarity].name}！`);
  };

  if (openingBox) {
    const { box, Game } = openingBox;
    return (
      <div className="shop-overlay">
        <div className="shop card">
          <div className="shop-head">
            <h2>{box.icon} 开{box.name}！</h2>
            <span className="shop-coins">💰 {coins}</span>
          </div>
          <Game onDone={settleBox(box)} levelBonus={box.levelBonus ?? 0} />
        </div>
      </div>
    );
  }

  return (
    <div className="shop-overlay">
      <div className="shop card">
        <div className="shop-head">
          <h2>🛒 网球用品店</h2>
          <span className="shop-coins">💰 {coins}</span>
          <button type="button" className="btn ghost shop-close-x" onClick={onClose} aria-label="关闭商店">×</button>
        </div>

        <div className="shop-section">
          <h3>🎁 盲盒（玩小游戏开盒，手越好开越好）</h3>
          <div className="shop-row">
            {BOXES.map((box) => (
              <button key={box.id} type="button" className="shop-item" onClick={() => buyBox(box)}>
                <span className="shop-icon">{box.icon}</span>
                <span>{box.name}</span>
                <small>{box.price}💰 · {box.desc}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="shop-section">
          <h3>战术卡（{CARD_PRICE}💰）</h3>
          <div className="shop-row">
            {cardOffers.map((id, i) => id && (
              <button key={i} type="button" className="shop-item" onClick={() => buyCard(i)}>
                <span className="shop-icon">{CARDS[id].icon}</span>
                <span>{CARDS[id].name}</span>
                <small>{CARDS[id].desc(false)}</small>
              </button>
            ))}
            {cardOffers.every((c) => !c) && <span className="shop-empty">已售罄</span>}
          </div>
        </div>

        <div className="shop-section">
          <h3>{deckLabel}强化（{CARD_UPGRADE_PRICE}💰）/ 移除（{CARD_REMOVE_PRICE}💰）{deckCap ? ` · ${deck.length}/${deckCap}` : ''}</h3>
          <div className="shop-row">
            {deck.map((c, i) => (
              <div key={`${c.cardId}-${i}`} className="shop-item static">
                <span className="shop-icon">{CARDS[c.cardId].icon}</span>
                <span>{CARDS[c.cardId].name}{c.upgraded ? '+' : ''}</span>
                <div className="shop-mini-actions">
                  {!c.upgraded && (
                    <button type="button" className="btn ghost mini" onClick={() => upgradeCard(i)}>强化</button>
                  )}
                  <button type="button" className="btn ghost mini" onClick={() => removeCard(i)}>移除</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="shop-section">
          <h3>装备架</h3>
          <div className="shop-row">
            {gearOffers.map((g, i) => g && (
              <button key={i} type="button" className="shop-item" onClick={() => buyGear(i)}>
                <span className="shop-icon">{SLOT_META[g.slot].icon}</span>
                <span style={{ color: RARITY_META[g.rarity].color }}>{gearLabel(g, g.slot)}</span>
                <small>{GEAR_PRICE[g.rarity]}💰</small>
              </button>
            ))}
            {gearOffers.every((g) => !g) && <span className="shop-empty">已售罄</span>}
          </div>
        </div>

        <div className="shop-section">
          <h3>装备升级</h3>
          <div className="shop-row">
            {EQUIPMENT_SLOTS.filter((s) => progress.equipment[s]).map((slot) => {
              const item = progress.equipment[slot];
              const cost = upgradeCost(item.rarity);
              return (
                <div key={slot} className="shop-item static">
                  <span className="shop-icon">{SLOT_META[slot].icon}</span>
                  <span style={{ color: RARITY_META[item.rarity].color }}>{gearLabel(item, slot)}</span>
                  {cost != null ? (
                    <button type="button" className="btn ghost mini" onClick={() => upgradeGear(slot)}>
                      升级 {cost}💰
                    </button>
                  ) : <small>已是传说</small>}
                </div>
              );
            })}
            {EQUIPMENT_SLOTS.every((s) => !progress.equipment[s]) && (
              <span className="shop-empty">还没有装备 —— 先去打几场吧</span>
            )}
          </div>
        </div>

        <div className="shop-exit-bar">
          <button type="button" className="btn ghost shop-exit-btn" onClick={onClose}>退出商店</button>
        </div>
      </div>
    </div>
  );
}
