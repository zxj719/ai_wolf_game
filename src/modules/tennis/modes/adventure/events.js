/**
 * events.js — 闯关事件表（spec §4.4）
 *
 * 「圆回来」机制：异想天开的小游戏/剧情，奖励全部映射网球能力
 * （属性/金币/卡牌/装备/临时体力上限）。
 * 小游戏复用对战小游戏组件（剧情文案重新包装），按表现分三档奖励。
 */

export const REWARD_KINDS = ['stat', 'coins', 'card', 'gear', 'energyMax', 'heal', 'nothing'];

/** 表现 → 奖励档：multiplier <0.8 → 0 / <1.2 → 1 / ≥1.2 → 2 */
export function rewardTier(multiplier) {
  if (multiplier >= 1.2) return 2;
  if (multiplier >= 0.8) return 1;
  return 0;
}

export const EVENTS = [
  // ===== 小游戏事件（4） =====
  {
    id: 'hotpot', chapter: 1, type: 'minigame', minigame: 'whackVolley', icon: '🍲',
    title: '火锅捞丸子大赛',
    text: '菜市场口的火锅摊主拦住你："捞丸子比手快，赢了教你两手绝活！"丸子浮起的瞬间就得下筷——这不就是网前截击吗？',
    rewards: [
      { kind: 'nothing', flavor: '丸子全沉了，摊主直摇头。' },
      { kind: 'stat', stat: 'skill', amount: 4, flavor: '捞起大半，手上功夫见长！' },
      { kind: 'stat', stat: 'skill', amount: 8, flavor: '筷出如电！摊主拜你为师。' },
    ],
  },
  {
    id: 'fanDodge', chapter: 1, type: 'minigame', minigame: 'rhythmBar', icon: '🪭',
    title: '蒲扇风暴',
    text: '误入广场舞核心区！大妈们的蒲扇带着节奏掀起风暴，跟上节拍才能全身而退——心态稳的人才看得清节奏。',
    rewards: [
      { kind: 'nothing', flavor: '被扇了一脸风，狼狈逃出。' },
      { kind: 'stat', stat: 'mind', amount: 4, flavor: '踩点全中，心如止水。' },
      { kind: 'stat', stat: 'mind', amount: 8, flavor: '与大妈共舞一曲，悟了。' },
    ],
  },
  {
    id: 'meditate', chapter: 2, type: 'minigame', minigame: 'precisionStop', icon: '🧘',
    title: '打坐数息',
    text: '修仙老者闭目盘坐："心跳停在第七息，便赠你盘缠。"精准的时机感——和切削放缓一个道理。',
    rewards: [
      { kind: 'coins', amount: 10, flavor: '差了半息，老者施舍了点零钱。' },
      { kind: 'coins', amount: 45, flavor: '恰到好处，老者抚须微笑。' },
      { kind: 'coins', amount: 90, flavor: '完美一息！老者倾囊相赠。' },
    ],
  },
  {
    id: 'zeroG', chapter: 3, type: 'minigame', minigame: 'gaugeDrop', icon: '🛰️',
    title: '失重颠球',
    text: '太空站的零重力舱里，网球飘在半空。轻、再轻一点——失重环境下颠球，练的是最细腻的力度控制和体能。',
    rewards: [
      { kind: 'nothing', flavor: '球飘走了，撞上了舷窗。' },
      { kind: 'energyMax', amount: 5, flavor: '颠了 50 下！心肺被失重训练拉满。' },
      { kind: 'energyMax', amount: 10, flavor: '太空颠球大师！体能上限突破。' },
    ],
  },

  // ===== 剧情二选一（8） =====
  {
    id: 'fishStall', chapter: 1, type: 'story', icon: '🐟',
    title: '鱼摊老板的赌局',
    text: '鱼摊老板拍着案板："接住我抛的三条鱼，白送你一副护腕；接不住，帮我守摊一小时。"',
    options: [
      { label: '接！反正手快', reward: { kind: 'gear', flavor: '三条全接住！老板心疼地递上护腕。' } },
      { label: '不赌，买条鱼补身体', reward: { kind: 'heal', amount: 40, flavor: '鱼汤下肚，体力回复。' } },
    ],
  },
  {
    id: 'lostRacket', chapter: 1, type: 'story', icon: '🎾',
    title: '菜市场的神秘球拍',
    text: '杂货堆里插着一支落灰的球拍，摊主说是"上届球王落下的"。要价不菲，但看纹路确实不凡。',
    options: [
      { label: '掏 30 金币买下', reward: { kind: 'gear', cost: 30, flavor: '擦去灰尘，拍身隐隐发光！' } },
      { label: '太贵了，转身就走', reward: { kind: 'coins', amount: 15, flavor: '路上捡到了别人掉的零钱。' } },
    ],
  },
  {
    id: 'immortalTea', chapter: 2, type: 'story', icon: '🍵',
    title: '仙人的茶摊',
    text: '云雾间一座茶摊："灵茶一盏，脱胎换骨；凡茶一盏，解乏顺气。施主选哪盏？"',
    options: [
      { label: '灵茶（玄学加点）', reward: { kind: 'stat', stat: 'random', amount: 8, flavor: '一口下去，经脉贲张！' } },
      { label: '凡茶（稳稳回体）', reward: { kind: 'heal', amount: 50, flavor: '舒坦。凡人有凡人的活法。' } },
    ],
  },
  {
    id: 'swordPavilion', chapter: 2, type: 'story', icon: '⚔️',
    title: '剑冢悟道',
    text: '万剑冢前石碑刻着："剑即是拍，拍即是剑。"在此参悟一晚，或许能将剑意化入球技，但夜里寒气伤身。',
    options: [
      { label: '参悟（技巧+6，体力-20）', reward: { kind: 'stat', stat: 'skill', amount: 6, healDelta: -20, flavor: '剑意入拍！但冻得直哆嗦。' } },
      { label: '赶路要紧', reward: { kind: 'card', flavor: '路边捡到一张前人遗落的战术卡。' } },
    ],
  },
  {
    id: 'alienBet', chapter: 3, type: 'story', icon: '👽',
    title: '外星观众的打赏',
    text: '一群外星游客围观你训练，叽叽喳喳地比划。领头的递来一袋发光的"币"，似乎想看你表演颠球。',
    options: [
      { label: '表演一段', reward: { kind: 'coins', amount: 60, flavor: '外星人集体亮灯鼓掌！打赏到手。' } },
      { label: '警惕地拒绝', reward: { kind: 'nothing', flavor: '他们失望地飘走了。谨慎也没错。' } },
    ],
  },
  {
    id: 'spaceGym', chapter: 3, type: 'story', icon: '🏋️',
    title: '太空健身舱',
    text: '舱门上写着"3 倍重力训练舱：变强或者趴下"。隔壁是按摩舱，柔和的灯光很诱人。',
    options: [
      { label: '3 倍重力特训', reward: { kind: 'stat', stat: 'sta', amount: 8, healDelta: -15, flavor: '腿在抖，但更强了。' } },
      { label: '按摩舱躺平', reward: { kind: 'heal', amount: 60, flavor: '从未如此放松。' } },
    ],
  },
  {
    id: 'oldRival', chapter: 2, type: 'story', icon: '🤝',
    title: '旧日宿敌',
    text: '上届家庭赛输给你的家人也在闯关，正坐在路边揉脚踝。"借我点金币买药……回头双倍还你。"',
    options: [
      { label: '借 20 金币', reward: { kind: 'card', cost: 20, flavor: 'ta 塞给你一张私藏战术卡："利息。"' } },
      { label: '装没看见', reward: { kind: 'nothing', flavor: '走出十米，背后传来一声"小气鬼！"' } },
    ],
  },
  {
    id: 'trophyShard', chapter: 3, type: 'story', icon: '🏆',
    title: '奖杯的碎片',
    text: '走廊尽头漂浮着一块金色碎片——是家族奖杯的一角！碰到它的瞬间，全家人的笑脸闪过眼前。',
    options: [
      { label: '握紧碎片', reward: { kind: 'stat', stat: 'mind', amount: 10, flavor: '为了家人，心意已决！' } },
      { label: '收进口袋换钱', reward: { kind: 'coins', amount: 80, flavor: '......你的良心不会痛吗？反正金币到手。' } },
    ],
  },
];

/** 按章节 + roll 取事件（小游戏与剧情混合池） */
export function pickEvent(chapter, roll) {
  const pool = EVENTS.filter((e) => e.chapter === chapter);
  return pool[Math.floor(roll * pool.length)] ?? pool[0];
}
