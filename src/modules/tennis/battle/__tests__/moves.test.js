import { describe, it, expect } from 'vitest';
import { MOVES, counterMultiplier, CHAR_BUILDS, ULTIMATES } from '../moves';

describe('MOVES 招式池（spec §1.2）', () => {
  it('包含全部 8 招且字段完整', () => {
    const ids = Object.keys(MOVES);
    expect(ids).toHaveLength(8);
    expect(ids.sort()).toEqual([
      'dropShot', 'flatDrive', 'lob', 'passingShot',
      'slice', 'smash', 'topspin', 'volley',
    ]);
    for (const m of Object.values(MOVES)) {
      expect(m).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        system: expect.stringMatching(/^(power|spin|net|control)$/),
        stat: expect.stringMatching(/^(sta|skill|mind)$/),
        energyCost: expect.any(Number),
        minigame: expect.any(String),
      });
    }
  });

  it('数值与 spec 一致：重炮耗体 20，切削耗体 3（R133 平衡补丁：取消体力回复）', () => {
    expect(MOVES.flatDrive.energyCost).toBe(20);
    expect(MOVES.slice.energyCost).toBe(-3);
    expect(MOVES.smash.energyCost).toBe(16);
    expect(MOVES.flatDrive.stat).toBe('sta');
    expect(MOVES.dropShot.stat).toBe('mind');
    expect(MOVES.topspin.stat).toBe('skill');
  });

  it('powerFactor：成本买威力，耗体越高系数越高（平衡补丁）', () => {
    expect(MOVES.flatDrive.powerFactor).toBe(1.30);
    expect(MOVES.slice.powerFactor).toBe(0.85);
    expect(MOVES.lob.powerFactor).toBe(0.86);
    // 单调性：按耗体排序 powerFactor 不降
    const sorted = Object.values(MOVES).sort((a, b) => a.energyCost - b.energyCost);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].powerFactor).toBeGreaterThanOrEqual(sorted[i - 1].powerFactor);
    }
  });
});

describe('counterMultiplier 克制表（spec §1.3）', () => {
  // 核心四循环：重炮→切削→上旋→放小球→重炮
  const coreChain = [
    ['flatDrive', 'slice'],
    ['slice', 'topspin'],
    ['topspin', 'dropShot'],
    ['dropShot', 'flatDrive'],
  ];
  // 网前组
  const netGroup = [
    ['volley', 'dropShot'],
    ['volley', 'slice'],
    ['passingShot', 'volley'],
    ['lob', 'volley'],
    ['smash', 'lob'],
  ];

  it.each([...coreChain, ...netGroup])('%s 克 %s → 1.5', (a, b) => {
    expect(counterMultiplier(a, b)).toBe(1.5);
  });

  it.each([...coreChain, ...netGroup])('被克反向 %s vs %s → 0.7', (a, b) => {
    expect(counterMultiplier(b, a)).toBe(0.7);
  });

  it('同招与无关均 1.0', () => {
    expect(counterMultiplier('flatDrive', 'flatDrive')).toBe(1.0);
    expect(counterMultiplier('smash', 'dropShot')).toBe(1.0);
    expect(counterMultiplier('lob', 'topspin')).toBe(1.0);
  });
});

describe('CHAR_BUILDS 七人配招（spec §1.7）', () => {
  it('七人各 4 招且 id 全部合法', () => {
    expect(Object.keys(CHAR_BUILDS)).toHaveLength(7);
    for (const build of Object.values(CHAR_BUILDS)) {
      expect(build.moves).toHaveLength(4);
      build.moves.forEach((id) => expect(MOVES[id]).toBeDefined());
      expect(build.style).toEqual(expect.any(String));
    }
  });

  it('诚=重炮流首招重炮，Elza=控制流首招切削', () => {
    expect(CHAR_BUILDS['诚'].moves).toEqual(['flatDrive', 'smash', 'topspin', 'passingShot']);
    expect(CHAR_BUILDS['Elza'].moves).toEqual(['slice', 'dropShot', 'lob', 'volley']);
  });
});

describe('ULTIMATES 绝技（spec §1.6）', () => {
  it('七张绝技结构完整且 owner 对应七人', () => {
    expect(Object.keys(ULTIMATES)).toHaveLength(7);
    const validTypes = new Set([
      'autoCounter', 'reveal', 'drainEnergy', 'freePower',
      'counterImmune', 'stealEnergy', 'fullRestore',
    ]);
    for (const u of Object.values(ULTIMATES)) {
      expect(Object.keys(CHAR_BUILDS)).toContain(u.owner);
      expect(validTypes.has(u.effect.type)).toBe(true);
    }
  });

  it('效果数值抽查：菲比吸 30 体、丫偷 15 体', () => {
    expect(ULTIMATES['兔子急停'].effect).toEqual({ type: 'drainEnergy', amount: 30 });
    expect(ULTIMATES['猫步上网'].effect).toEqual({ type: 'stealEnergy', amount: 15 });
  });
});
