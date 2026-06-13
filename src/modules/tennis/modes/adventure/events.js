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

  // ===== 坚持/刷分类事件（D 段新增 4） =====
  {
    id: 'marketTreasure', chapter: 1, type: 'minigame', minigame: 'goldMiner', icon: '⛏️',
    title: '市场寻宝',
    text: '废弃摊位下埋着前任摊主的"小金库"。借来钩爪开挖——手眼协调是网球手的天赋技能。',
    rewards: [
      { kind: 'coins', amount: 10, flavor: '只挖到几个钢镚……' },
      { kind: 'coins', amount: 50, flavor: '小赚一笔！' },
      { kind: 'coins', amount: 100, flavor: '挖到金库主矿脉！' },
    ],
  },
  {
    id: 'swordFlight', chapter: 2, type: 'minigame', minigame: 'flappy', icon: '🗡️',
    title: '御剑穿峰',
    text: '仙人借你一把飞剑过山：撞上山岩就摔下去。10 秒的御剑，练的是临场反应——和接发球一个道理。',
    rewards: [
      { kind: 'nothing', flavor: '摔进云海，仙人捞了你三次。' },
      { kind: 'stat', stat: 'random', amount: 6, flavor: '御剑成功，身法大进！' },
      { kind: 'stat', stat: 'random', amount: 6, flavor: '御剑成功，身法大进！' },
    ],
  },
  {
    id: 'cloudLadder', chapter: 2, type: 'minigame', minigame: 'jumpJump', icon: '☁️',
    title: '踏云梯',
    text: '一截一截的云阶通向山顶，蓄力跳——力道拿捏正是放小球的精髓。15 秒能跳多高？',
    rewards: [
      { kind: 'coins', amount: 15, flavor: '跳了几阶就脚滑……' },
      { kind: 'stat', stat: 'mind', amount: 5, flavor: '步步生莲，心境提升。' },
      { kind: 'stat', stat: 'mind', amount: 10, flavor: '直上云顶！心如磐石。' },
    ],
  },
  {
    id: 'meteorRain', chapter: 3, type: 'minigame', minigame: 'dodge', icon: '☄️',
    title: '陨石雨警报',
    text: '舱外维修时遭遇微陨石雨！左右机动撑过 10 秒等待气闸开启——步伐就是网球手的命。',
    rewards: [
      { kind: 'nothing', flavor: '被擦伤了，幸好宇航服结实。' },
      { kind: 'gear', flavor: '全身而退，还顺手抓到一块" 装备级"陨石！' },
      { kind: 'gear', flavor: '全身而退，还顺手抓到一块"装备级"陨石！' },
    ],
  },

  // ===== 新增小游戏事件（4） =====
  {
    id: 'drumBeat', chapter: 1, type: 'minigame', minigame: 'rhythmMash', icon: '🥁',
    title: '鼓楼晨练',
    text: '社区鼓楼旁，老大爷正打腰鼓。"来！一起！节奏稳的人球也稳！"跟上节拍连续击打——这正是底线重炮的爆发感。',
    rewards: [
      { kind: 'nothing', flavor: '拍子全乱了，大爷扶额叹气。' },
      { kind: 'stat', stat: 'sta', amount: 4, flavor: '鼓声铿锵，臂力见长！' },
      { kind: 'stat', stat: 'sta', amount: 8, flavor: '擂鼓如雷！大爷收你为徒。' },
    ],
  },
  {
    id: 'marketPingPong', chapter: 1, type: 'minigame', minigame: 'dualTiming', icon: '🏓',
    title: '摊位乒乓',
    text: '两个摊主用案板当球拍对打，球飞来了："来接一下！"双向时机——穿越球难在同时判断对手位置和球的轨迹。',
    rewards: [
      { kind: 'nothing', flavor: '接空了，球砸进了豆腐堆。' },
      { kind: 'stat', stat: 'skill', amount: 5, flavor: '接住了！手眼协调显著提升。' },
      { kind: 'stat', stat: 'skill', amount: 9, flavor: '打了个来回！摊主们鼓掌叫好。' },
    ],
  },
  {
    id: 'stonePalm', chapter: 2, type: 'minigame', minigame: 'shrinkSmash', icon: '🪨',
    title: '掌心碎石',
    text: '修仙界武道考核：窗口收拢时果断落掌，石块应声而碎。"窗口即天道——最好的时机只有一瞬。"高压扣杀的精髓。',
    rewards: [
      { kind: 'nothing', flavor: '窗口没踩上，石头完好无损，手还麻了。' },
      { kind: 'stat', stat: 'skill', amount: 4, flavor: '碎了大半！时机感大进。' },
      { kind: 'stat', stat: 'skill', amount: 8, flavor: '一击粉碎！考官拍案叫绝。' },
    ],
  },
  {
    id: 'asteroidReact', chapter: 3, type: 'minigame', minigame: 'directionReact', icon: '🌌',
    title: '星际急刹',
    text: '飞船穿越小行星带！预判来袭方向、急速变向规避——和判断挑高球落点一个道理。左还是右？只有一秒。',
    rewards: [
      { kind: 'nothing', flavor: '被蹭了一下，宇航服轻微受损。' },
      { kind: 'stat', stat: 'mind', amount: 4, flavor: '全部规避！判断力显著提升。' },
      { kind: 'energyMax', amount: 8, flavor: '完美穿越！极限机动把体能逼出了新极限。' },
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

  // ===== 新增剧情事件（4） =====
  {
    id: 'cobbler', chapter: 1, type: 'story', icon: '👟',
    title: '修鞋匠的跑鞋',
    text: '菜市场角落的修鞋老匠拿出一双磨损的旧跑鞋："我儿子是运动员留下的，放着浪费。给你穿比锁在柜子里强。"',
    options: [
      { label: '接过穿上', reward: { kind: 'gear', flavor: '鞋底弹性超好！这双鞋有故事。' } },
      { label: '婉拒，买双新球袜', reward: { kind: 'heal', amount: 20, flavor: '新袜子舒适，步伐轻盈了许多。' } },
    ],
  },
  {
    id: 'templeOracle', chapter: 2, type: 'story', icon: '🔮',
    title: '道观问签',
    text: '古庙香火缭绕，道长缓缓递出签文："上上签——顺势借力；下下签——硬碰逆势。网球亦是此理，施主作何选择？"',
    options: [
      { label: '顺势（抽一张战术卡）', reward: { kind: 'card', flavor: '签文化成一张卡——运势加持。' } },
      { label: '硬碰（技巧+7，体力-10）', reward: { kind: 'stat', stat: 'skill', amount: 7, healDelta: -10, flavor: '逆流而上！技艺大进，但耗神不少。' } },
    ],
  },
  {
    id: 'spaceCook', chapter: 3, type: 'story', icon: '🍜',
    title: '太空厨师的烦恼',
    text: '太空站食堂厨师愁眉苦脸："零重力煮面，面条全飘走了！帮我捞回来换你一顿好的。"',
    options: [
      { label: '帮忙捞面', reward: { kind: 'coins', amount: 50, flavor: '捞面技术一流！厨师红包塞过来。' } },
      { label: '点现成的快餐', reward: { kind: 'heal', amount: 30, flavor: '快餐热乎，体力回复不少。' } },
    ],
  },
  {
    id: 'familyPhoto', chapter: 3, type: 'story', icon: '📸',
    title: '走廊里的合影',
    text: '走廊墙上贴着一张旧照片——全家人举着奖杯合影，每个人都笑得合不拢嘴。背面写着："冠军不重要，一起打球最好。"',
    options: [
      { label: '放下包袱，记住这笑脸', reward: { kind: 'stat', stat: 'mind', amount: 10, flavor: '心里暖了，脚步也轻了。' } },
      { label: '拍张照发给家人', reward: { kind: 'coins', amount: 30, flavor: '家人回了一堆红包表情包。意外收入！' } },
    ],
  },
];

/** 按章节 + roll 取事件（小游戏与剧情混合池） */
export function pickEvent(chapter, roll) {
  const pool = EVENTS.filter((e) => e.chapter === chapter);
  return pool[Math.floor(roll * pool.length)] ?? pool[0];
}
