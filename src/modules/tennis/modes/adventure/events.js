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

  // ===== 新增小游戏事件（8）=====
  {
    id: 'deliveryDodge', chapter: 1, type: 'minigame', minigame: 'dodge', icon: '🛵',
    title: '外卖骑手大冲关',
    text: '外卖小哥被堵在市场门口急得团团转："帮我把这单送出去！"菜摊、水桶、横穿的大妈——一路全是障碍。闪躲就是步伐练习。',
    rewards: [
      { kind: 'nothing', flavor: '单送丢了一半，小哥哭笑不得。' },
      { kind: 'coins', amount: 30, flavor: '准时送达！小费落袋。' },
      { kind: 'coins', amount: 70, flavor: '极速通关！顺路收了三个邻居的外卖费。' },
    ],
  },
  {
    id: 'coachDrill', chapter: 2, type: 'minigame', minigame: 'gaugeDrop', icon: '💪',
    title: '铁人教练的精准课',
    text: '山腰古寺兼职健身堂，铁人教练指着沙袋："出拳那一刻全力制动——力道收得准才是高手。"精准收力，和网球触球瞬间一个道理。',
    rewards: [
      { kind: 'nothing', flavor: '手劲没收住，打穿了沙袋，赔了钱。' },
      { kind: 'stat', stat: 'sta', amount: 4, flavor: '收力完美！力量训练见效。' },
      { kind: 'energyMax', amount: 10, flavor: '极致控制！体能上限突破，肌肉记忆刻入灵魂。' },
    ],
  },
  {
    id: 'wuxiaReflex', chapter: 2, type: 'minigame', minigame: 'directionReact', icon: '🥷',
    title: '侠客的方向考',
    text: '林间岩石上盘坐一侠客，目如寒星："刀来——左还是右？出手即命运。"木剑猝然袭来，方向判断是内功之魂，也是接球之本。',
    rewards: [
      { kind: 'nothing', flavor: '判断错了，被木剑轻轻点了脑门。' },
      { kind: 'stat', stat: 'skill', amount: 4, flavor: '全数判对！身法敏锐度大进。' },
      { kind: 'stat', stat: 'mind', amount: 7, flavor: '完美预判！侠客收剑："孺子可教。"心境跃升一界。' },
    ],
  },
  {
    id: 'asteroidDance', chapter: 3, type: 'minigame', minigame: 'rhythmBar', icon: '🌌',
    title: '星际颁奖节奏课',
    text: '太空站「银河联赛百周年」庆典，礼宾官拦住你："贵宾欢迎仪式——跟上异星节奏！"外星拍子奇特，心律稳定才能踩准。',
    rewards: [
      { kind: 'nothing', flavor: '节奏全乱，外星观众集体回避目光。' },
      { kind: 'coins', amount: 45, flavor: '节奏踩准！外星贵宾塞来一袋赞助币。' },
      { kind: 'stat', stat: 'mind', amount: 7, flavor: '完美合拍！异星乐感打通了你的节奏天赋。' },
    ],
  },

  // ===== 新增剧情事件（8）=====
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
  {
    id: 'streetBusker', chapter: 1, type: 'story', icon: '🎸',
    title: '市场口的吉他少年',
    text: '出市场时，一个少年坐在路边弹吉他，唱的词像是在描述小时候打球的自己。帽子里只有几枚硬币。',
    options: [
      { label: '投 20 金币打赏', reward: { kind: 'card', cost: 20, flavor: '少年激动地从琴包翻出一张手写战术卡："我哥留下的，送有缘人！"' } },
      { label: '驻足听完整首', reward: { kind: 'stat', stat: 'mind', amount: 6, flavor: '音乐让你想起打球最初的感觉，心境澄澈。' } },
    ],
  },
  {
    id: 'oldCoach', chapter: 1, type: 'story', icon: '🎓',
    title: '路边的老教练',
    text: '老教练认出了你，递来一瓶运动饮料，叹了口气："你的步法还是那个老毛病——左脚发力不够，什么时候改？"',
    options: [
      { label: '当场跟他练步法', reward: { kind: 'stat', stat: 'skill', amount: 6, flavor: '反复拆解动作，步伐控制质感提升一个档次。' } },
      { label: '喝完道谢就跑', reward: { kind: 'heal', amount: 25, flavor: '运动饮料真好喝，腿不酸了。' } },
    ],
  },
  {
    id: 'mediaInterview', chapter: 2, type: 'story', icon: '📰',
    title: '赛道边的媒体记者',
    text: '记者拦住你："请问本场赢了有什么感言？"镜头红灯亮着，时间只有五秒。',
    options: [
      { label: '夸张演讲，吸引赞助商', reward: { kind: 'coins', amount: 50, flavor: '演讲后走了三步，信封塞进手里——"赞助费。"' } },
      { label: '低调作答，节省精力', reward: { kind: 'stat', stat: 'mind', amount: 5, healDelta: 10, flavor: '"我只是享受比赛。"说完心情轻松，体力也悄悄回了些。' } },
    ],
  },
  {
    id: 'starStation', chapter: 3, type: 'story', icon: '🎆',
    title: '百年庆典的邀请',
    text: '太空站「银河联赛百周年」，舷窗外焰火绽放。服务机器人端着香槟："贵宾，要参加庆典吗？"',
    options: [
      { label: '赴宴放松（回体充足）', reward: { kind: 'heal', amount: 60, flavor: '香槟入喉，音乐绕梁，体力回满大半。' } },
      { label: '谢绝，保持竞技状态', reward: { kind: 'stat', stat: 'random', amount: 8, flavor: '专注比赛的状态让你在角落偷练了半小时，某项属性突飞猛进。' } },
    ],
  },

  // ===== 第 11 轮扩充：6 个新事件（3 小游戏 + 3 剧情，每章各 2）=====

  // 第一章 · 菜市场江湖（+1 minigame）
  {
    id: 'wokChef', chapter: 1, type: 'minigame', minigame: 'rhythmMash', icon: '🍳',
    title: '铁锅颠勺大赛',
    text: '夜市收摊前，大厨临时拉你进厨房："帮我颠够三十下锅！颠锅讲究节奏和爆发力——这不就是底线抽击的精髓？"老食客们在旁边计数围观。',
    rewards: [
      { kind: 'nothing', flavor: '节奏全乱，锅里的菜飞了一半，大厨欲哭无泪。' },
      { kind: 'stat', stat: 'sta', amount: 4, flavor: '颠出火候！反复爆发的手臂力量悄悄提升了。' },
      { kind: 'stat', stat: 'sta', amount: 8, flavor: '三十下行云流水！大厨收你为关门弟子，体能飙升。' },
    ],
  },

  // 第一章 · 菜市场江湖（+1 story）
  {
    id: 'catChase', chapter: 1, type: 'story', icon: '🐱',
    title: '流浪猫的秘密',
    text: '一只橘猫衔着什么东西从你脚边跑过——仔细一看，是一张折叠的纸条，夹着一枚金币。猫停下来，用眼神示意你。',
    options: [
      { label: '跟猫走看究竟', reward: { kind: 'gear', flavor: '老屋角落里，一箱落灰的运动装备在等着你。' } },
      { label: '摸摸猫就走', reward: { kind: 'heal', amount: 20, flavor: '橘猫在你腿上蹭了两下，心情大好，步伐也轻盈了许多。' } },
    ],
  },

  // 第二章 · 修仙界（+1 minigame）
  {
    id: 'mountDebate', chapter: 2, type: 'minigame', minigame: 'dualTiming', icon: '⚖️',
    title: '论道擂台双鼓',
    text: '修仙界论道擂台规则简单：师叔抛问，双手同时各拍一面玄鼓作答。"左问智，右问力，拍鼓的时机就是你的答案。"这和网前截击双手握拍一个道理。',
    rewards: [
      { kind: 'nothing', flavor: '双鼓差了半拍，师叔轻叹："火候未到。"' },
      { kind: 'stat', stat: 'mind', amount: 5, flavor: '左右齐鸣！智力与心态同步提升。' },
      { kind: 'stat', stat: 'skill', amount: 9, flavor: '完美共振！擂台老人动容："百年一见的双鼓天才！"技巧大涨。' },
    ],
  },

  // 第二章 · 修仙界（+1 story）
  {
    id: 'sealSpirit', chapter: 2, type: 'story', icon: '🔯',
    title: '封印中的灵兽',
    text: '一个光球被困在符咒阵中，冲你发出微弱光芒。符咒刻着："解开者，得其缘；吸收者，得其力。"',
    options: [
      { label: '破除符咒放走灵兽', reward: { kind: 'card', flavor: '灵兽感激地消散，留下一张充满灵气的战术卡。' } },
      { label: '吸收封印能量', reward: { kind: 'stat', stat: 'sta', amount: 7, flavor: '封印能量涌入体内，体能大幅提升，但光球的眼神久久萦绕。' } },
    ],
  },

  // 第三章 · 太空站（+1 minigame）
  {
    id: 'dockPrecision', chapter: 3, type: 'minigame', minigame: 'gaugeDrop', icon: '🛸',
    title: '飞船对接精度训练',
    text: '太空站训练舱：模拟飞船对接——推进器必须在窗口读数恰好归零时制动。误差超过 0.1% 就功亏一篑。比网球触球瞬间的力度控制还精密。',
    rewards: [
      { kind: 'nothing', flavor: '对接口擦过，训练舱响起警报音。教官摇头："再来一百次。"' },
      { kind: 'stat', stat: 'skill', amount: 5, flavor: '对接成功！精准制动的感觉深入肌肉记忆，技巧提升。' },
      { kind: 'energyMax', amount: 10, flavor: '完美归零！极限精准的专注把体能极限也一并突破了。' },
    ],
  },

  // 第三章 · 太空站（+1 story）
  {
    id: 'timeZone', chapter: 3, type: 'story', icon: '⏱️',
    title: '时区悖论',
    text: '穿越时区时，服务机器人递上一枚记忆补丁："植入后你将记住所有对手的出招习惯。但副作用是短时头晕，体力下降。"',
    options: [
      { label: '植入记忆补丁', reward: { kind: 'stat', stat: 'mind', amount: 8, healDelta: -10, flavor: '头晕片刻……对手动作在脑中逐帧回放，判断力跃升一级。' } },
      { label: '谢绝，让记忆自然沉淀', reward: { kind: 'heal', amount: 35, flavor: '好好睡一觉，第二天精神满满，体力恢复如初。' } },
    ],
  },
];

/** 按章节 + roll 取事件（小游戏与剧情混合池） */
export function pickEvent(chapter, roll) {
  const pool = EVENTS.filter((e) => e.chapter === chapter);
  return pool[Math.floor(roll * pool.length)] ?? pool[0];
}
