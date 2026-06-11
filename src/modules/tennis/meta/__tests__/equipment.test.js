import { describe, it, expect } from 'vitest';
import {
  EQUIPMENT_SLOTS, RARITIES, SLOT_VALUES, CHARM_SPECIALS,
  rollDrop, upgradeCost, sellValue, applyEquipment, mergeDrop,
} from '../equipment';

describe('装备数据表（spec §2.1）', () => {
  it('5 槽 4 品质，数值与表一致', () => {
    expect(EQUIPMENT_SLOTS).toEqual(['racket', 'shoes', 'grip', 'wristband', 'charm']);
    expect(RARITIES).toEqual(['common', 'fine', 'epic', 'legendary']);
    expect(SLOT_VALUES.racket).toEqual([2, 4, 7, 12]);     // +力量
    expect(SLOT_VALUES.shoes).toEqual([6, 12, 20, 30]);    // +体力上限
    expect(SLOT_VALUES.grip).toEqual([2, 4, 7, 12]);       // +技巧
    expect(SLOT_VALUES.wristband).toEqual([2, 4, 7, 12]);  // +心态
    expect(CHARM_SPECIALS).toHaveLength(5);
  });

  it('升级价格阶梯 50/120/300，传说不可升', () => {
    expect(upgradeCost('common')).toBe(50);
    expect(upgradeCost('fine')).toBe(120);
    expect(upgradeCost('epic')).toBe(300);
    expect(upgradeCost('legendary')).toBe(null);
  });

  it('出售价按品质递增', () => {
    expect(sellValue('common')).toBeLessThan(sellValue('fine'));
    expect(sellValue('epic')).toBeLessThan(sellValue('legendary'));
  });
});

describe('rollDrop 掉落（rng 注入）', () => {
  it('胜利掉落高一档概率：rng 0.99 → 传说', () => {
    const d = rollDrop('win', () => 0.99);
    expect(d.rarity).toBe('legendary');
  });

  it('败北保底：rng 0.99 → 最高史诗或以下（1% 传说线之外）', () => {
    const d = rollDrop('loss', () => 0.989);
    expect(['common', 'fine', 'epic']).toContain(d.rarity);
  });

  it('rng 0 → 普通；槽位由 rng 决定且合法', () => {
    const d = rollDrop('win', () => 0);
    expect(d.rarity).toBe('common');
    expect(EQUIPMENT_SLOTS).toContain(d.slot);
  });

  it('挂件掉落带特效词条', () => {
    // 构造 rng 序列：第一次取槽位（→charm），后续取品质/特效
    const seq = [0.95, 0.5, 0.5];   // slot roll 0.95 → 第 5 槽 charm
    let i = 0;
    const d = rollDrop('win', () => seq[Math.min(i++, seq.length - 1)]);
    expect(d.slot).toBe('charm');
    expect(d.special).toBeDefined();
  });
});

describe('applyEquipment 合成加成', () => {
  it('空装备零加成', () => {
    expect(applyEquipment({})).toEqual({ sta: 0, skill: 0, mind: 0, energyMax: 0, special: {} });
  });

  it('全套史诗：sta7/skill7/mind7/energyMax20 + 特效', () => {
    const equipped = {
      racket: { rarity: 'epic' },
      shoes: { rarity: 'epic' },
      grip: { rarity: 'epic' },
      wristband: { rarity: 'epic' },
      charm: { rarity: 'epic', special: 'counterBoost' },
    };
    const r = applyEquipment(equipped);
    expect(r).toMatchObject({ sta: 7, skill: 7, mind: 7, energyMax: 20 });
    expect(r.special.counterBoost).toBe(0.1);
  });
});

describe('mergeDrop 同槽保高', () => {
  it('更高品质替换并卖掉旧的', () => {
    const { equipped, soldFor } = mergeDrop(
      { racket: { rarity: 'common' } },
      { slot: 'racket', rarity: 'epic' }
    );
    expect(equipped.racket.rarity).toBe('epic');
    expect(soldFor).toBe(sellValue('common'));
  });

  it('更低或同品质直接折现', () => {
    const { equipped, soldFor } = mergeDrop(
      { racket: { rarity: 'epic' } },
      { slot: 'racket', rarity: 'fine' }
    );
    expect(equipped.racket.rarity).toBe('epic');
    expect(soldFor).toBe(sellValue('fine'));
  });

  it('空槽直接装备', () => {
    const { equipped, soldFor } = mergeDrop({}, { slot: 'shoes', rarity: 'fine' });
    expect(equipped.shoes.rarity).toBe('fine');
    expect(soldFor).toBe(0);
  });
});
