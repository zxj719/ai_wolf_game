/**
 * ShopPanel.jsx — 商店五项服务（spec §2.1/§4.2）：
 * 购卡 3 选 1 / 卡牌升级 / 购装 3 件 / 装备品质升级 / 移除卡牌。
 * B 段用于家族挑战赛间，C 段复用为闯关商店节点。
 * 金币与装备走 progress（onUpdateProgress 由调用方持久化），卡牌走单局 deck。
 */

import { useState } from 'react';
import { CARDS } from '../battle/cards';
import {
  rollDrop, mergeDrop, upgradeCost, nextRarity, sellValue,
  SLOT_META, RARITY_META, EQUIPMENT_SLOTS,
} from './equipment';

const CARD_PRICE = 40;
const CARD_UPGRADE_PRICE = 30;
const CARD_REMOVE_PRICE = 25;
const GEAR_PRICE = { common: 30, fine: 60, epic: 140, legendary: 320 };

const cardIds = Object.keys(CARDS);
const randomCardId = () => cardIds[Math.floor(Math.random() * cardIds.length)];

function gearLabel(item, slot) {
  return `${RARITY_META[item.rarity].name}${SLOT_META[slot].name}`;
}

export function ShopPanel({ progress, onUpdateProgress, deck, onDeckChange, onClose, toast }) {
  const [cardOffers, setCardOffers] = useState(() => [randomCardId(), randomCardId(), randomCardId()]);
  const [gearOffers, setGearOffers] = useState(() => [
    rollDrop('event', Math.random), rollDrop('event', Math.random), rollDrop('event', Math.random),
  ]);
  const coins = progress.coins;

  const spend = (amount) => {
    onUpdateProgress({ ...progress, coins: coins - amount });
  };

  const buyCard = (i) => {
    if (coins < CARD_PRICE) { toast('金币不够！'); return; }
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

  return (
    <div className="shop-overlay">
      <div className="shop card">
        <div className="shop-head">
          <h2>🛒 网球用品店</h2>
          <span className="shop-coins">💰 {coins}</span>
          <button type="button" className="btn ghost" onClick={onClose}>离开商店</button>
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
          <h3>卡牌强化（{CARD_UPGRADE_PRICE}💰）/ 移除（{CARD_REMOVE_PRICE}💰）</h3>
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
      </div>
    </div>
  );
}
