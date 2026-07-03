/**
 * mapGen.js — 奇幻闯关节点地图生成（纯函数，spec §4.2）
 *
 * 结构：3 章 × 4-5 步，每步 1-2 个节点二选一（线性步进保证必达 BOSS）。
 * 每章末步固定精英战；第三章末为 BOSS「网球之神」。
 * 节点类型权重：对战 40% / 事件 30% / 商店 15% / 休息 15%。
 */

export const NODE_TYPES = ['battle', 'event', 'shop', 'rest'];

const CHAPTERS = [
  { title: '第一章 · 菜市场江湖', theme: 'market', regular: '广场舞大妈', elite: '外卖小哥' },
  { title: '第二章 · 修仙界', theme: 'immortal', regular: '太极宗师', elite: '修仙童子' },
  { title: '第三章 · 太空站', theme: 'space', regular: 'BOT-3000', elite: '网球之神' },
  { title: '第四章 · 传说殿堂', theme: 'legend', regular: '传说幽灵', elite: '永恒球王' },
];

function rollNodeType(rng) {
  const r = rng();
  if (r < 0.40) return 'battle';
  if (r < 0.70) return 'event';
  if (r < 0.85) return 'shop';
  return 'rest';
}

let nodeSeq = 0;
function makeNode(type, chapter, rng) {
  const node = { id: `n${nodeSeq++}`, type };
  if (type === 'battle') {
    // 常规对战：本章离谱对手 或 同样来闯关的家人客串
    node.opponentId = rng() < 0.6 ? chapter.regular : 'family';
  }
  if (type === 'event') {
    node.eventRoll = rng();   // 事件由 events.js 按章节+roll 解析
  }
  return node;
}

export function generateMap(rng) {
  nodeSeq = 0;
  const chapters = CHAPTERS.map((ch, ci) => {
    const stepCount = 4 + (rng() < 0.5 ? 0 : 1);   // 4-5 步（含末步精英）
    const steps = [];
    for (let s = 0; s < stepCount - 1; s++) {
      const optionCount = rng() < 0.55 ? 2 : 1;
      const step = [];
      for (let o = 0; o < optionCount; o++) {
        step.push(makeNode(rollNodeType(rng), ch, rng));
      }
      steps.push(step);
    }
    steps.push([{
      id: `n${nodeSeq++}`,
      type: 'battle',
      opponentId: ch.elite,
      elite: true,
      ...(ci === CHAPTERS.length - 1 ? { boss: true } : {}),
    }]);
    return { title: ch.title, theme: ch.theme, regular: ch.regular, steps };
  });
  return { chapters };
}
