/**
 * 赛后动态点评库 — 纯前端字符串模板，零后端依赖。
 * 根据 胜负 × 比分 × 统计数据 × 角色 组合选出一句点评。
 */

const CHAR_WIN_QUIPS = {
  '诚': [
    '诚 今天说到做到——赢就是赢，不用废话！',
    '诚 的正手抽球今天打出了火花，{oppName} 完全预判不了！',
    '诚 挥拍的瞬间，{oppName} 的眼神就已经输了！',
    '简简单单，{oppName}，这就是我的力量——别不服气。',
  ],
  'Elza': [
    '狐步切球走位完美，Elza 把 {oppName} 的每一招都读透了',
    'Elza 的控制打法今天滴水不漏，{oppName} 落子无处可落',
    'Elza 今天的节奏控制如同棋局——{oppName} 落的每一子都在她的预谋里',
    '「狐」步已定，{oppName} 还没来得及反应，胜利已经是 Elza 的了',
  ],
  '菲比': [
    '菲比 小兔子今天爆发了！冲刺速度直接把 {oppName} 甩在身后',
    '菲比 运气爆棚，但运气只属于努力的人！',
    '菲比 的步伐轻盈得像在飞，{oppName} 的每一个落点都被提前堵死！',
    '你以为是兔子？菲比 今天简直是飞弹——{oppName} 连影子都没追到',
  ],
  'Ross': [
    'Ross 用数据和力量双重碾压，{oppName} 毫无还手之力',
    '龙威显现，Ross 今天的击球精准度已超越人类极限',
    '数据不会说谎——Ross 今天的胜率从第一球开始就是 99%',
    'Ross 的击球轨迹和 {oppName} 的步伐形成完美的反向方程，胜局早已注定',
  ],
  '铁蛋': [
    '铁蛋 铲球连连，手劲果然是天天炒菜练出来的！',
    '铁蛋 体力满格，把 {oppName} 拖到最后一口气才收割',
    '铁蛋 的力量今天好比锅气十足——{oppName} 根本挡不住这股火！',
    '又一个被铁蛋 教训的：灶台练出的臂力，不是随随便便能接住的',
  ],
  '丫': [
    '丫 猫式打法神出鬼没，{oppName} 根本抓不住节奏',
    '喵！丫 今天很满意，奖励自己多睡一觉',
    '丫 每一拍都猫着身子等时机——等 {oppName} 以为自己要赢了，才不紧不慢出手',
    '{oppName} 被丫 的节奏晃花了眼，而丫 只是懒洋洋地打了个哈欠',
  ],
  '莹': [
    '莹 优雅而致命，每一拍都像是预谋好的',
    '莹 的落点控制炉火纯青，{oppName} 跑断腿也追不上',
    '莹 的球如同诗句，每一个弧线都是精心挑选的语言——{oppName} 看不懂才输的',
    '赢得漂亮，才是莹 的标准——今天这局，每一拍都达标了',
  ],
};

const CHAR_LOSS_QUIPS = {
  '诚': [
    '诚 不甘心，但输了就是输了——下次一定打回来！',
    '诚 今天状态没在线，但斗志 100% 还在！',
    '拳头攥紧了，{oppName}，等我下次再来，那才是真正的决战',
    '诚 今天碰上的是什么！没关系，加倍练，加倍赢回来',
  ],
  'Elza': [
    'Elza 今天罕见翻车……但她只是在给对手「看一个意思」',
    '今天的 Elza 是故意让 {oppName} 赢的？谁知道呢',
    '（Elza 已在心中默默记下 {oppName} 今天每一招的破绽）',
    'Elza 输了这局，但棋局还长——{oppName}，别松懈',
  ],
  '菲比': [
    '菲比 输了，回去找妈妈撒个娇，明天又是好兔！',
    '菲比 幸运值今天欠费，充好电再来挑战 {oppName}！',
    '菲比 眼眶红了一下，但又抬起头来——"才不服气呢，下次我要练一百个小时！"',
    '跑得那么快还输了？{oppName} 你等我，小兔子会变成飞毛腿来找你算账！',
  ],
  'Ross': [
    'Ross 数据报错了……他表示下次一定会 patch 自己',
    '龙也有栽跟头的时候，Ross 已在分析复盘数据',
    '复盘数据已压入 Ross 的分析模块，{oppName} 的每一招缺陷下次都会被精准反制',
    '失败只是一次测试样本——Ross 表示，下次不会再给 {oppName} 第二次机会',
  ],
  '铁蛋': [
    '铁蛋 肚子饿了还是怎么了？去吃碗饭再来找 {oppName} 算账！',
    '铁蛋 今天手滑，灶台上才是主场',
    '哎呀！输了，得回去再炒一百个菜补仓！等臂力练足了，{oppName}，我来找你！',
    '铁蛋 输球比输菜单更难受——回头看看哪道功夫没练到位',
  ],
  '丫': [
    '喵……丫 输了，假装在睡觉，别打扰',
    '丫 今天心情不好，猫没有输，只有不高兴',
    '（丫 转过身，尾巴翘得笔直，背影写着「本猫不服」）',
    '丫 悄悄记下了 {oppName} 的三个漏洞——等 ta 发现，已经被反杀了',
  ],
  '莹': [
    '莹 优雅地输了——但心里已经计划好下一局怎么赢回来',
    '莹 保留了一手，下次才好让你们见识真正的水准',
    '莹 轻轻敛起裙摆，微微颔首——但那眼眸里，已是下一局的风云',
    '输了也要输得好看——莹 今天做到了，但下次，会赢得更好看',
  ],
};

const ACE_WIN_LINES = [
  '打出 {aces} 个 ACE！{playerName} 今天的球速让 {oppName} 的球拍只剩扇风的份',
  '{aces} 次 ACE 直接封神——{playerName} 的发球今天像光速',
  'ACE 连炮！{playerName} 的第一拍就让 {oppName} 望球兴叹',
];

const CLUTCH_WIN_LINES = [
  '{clutchWins} 个关键分全部拿下，{playerName} 的大心脏今晚闪闪发光',
  '压哨关键分！{playerName} 在最绝望时把分数掰了回来，气死 {oppName}',
  '{clutchWins} 次 CLUTCH 得分，{playerName} 越紧张越准，反人类操作！',
];

const COUNTER_WIN_LINES = [
  '克制 {countersWon} 次！{playerName} 把 {oppName} 的套路全看穿了',
  '{playerName} 今天读招神准，{countersWon} 次以招克招，{oppName} 毫无脾气',
  '反制大师！{countersWon} 次克制得分，{playerName} 把 {oppName} 的剧本撕了个粉碎',
];

const SWEEP_LINES = [
  '完美横扫！{oppName} 还没想好怎么赢，{playerName} 已经收拍走人了',
  '2:0 收官，{playerName} 今天打出了训练的最高水准，干净利落！',
  '{oppName} 全程追分却没能追上，{playerName} 稳如老狗',
];

const COMEBACK_LINES = [
  '先掉一盘，背水一战，{playerName} 打出了教科书级别的逆袭！',
  '2:1 险胜！这盘比分看得人心跳加速，{playerName} 的意志力才是今晚 MVP',
  '{playerName} 丢掉第一盘后越战越狂，{oppName} 反被自己的傲气坑了',
];

const GENERIC_WIN_LINES = [
  '{playerFace} {playerName} 赢啦！今晚 {oppName} 可能要悄悄练球到深夜了',
  '胜利属于 {playerName}，{oppName} 服气但不甘心，完美',
  '{playerName} 今天水准正常发挥，{oppName} 发挥……也很正常，只是不如你',
];

const ACE_LOSS_LINES = [
  '打出了 {aces} 个 ACE 还输？只能说 {oppName} 今天进入了神级状态',
  '{aces} 次 ACE 也没救回来——{playerName} 的发球不是问题，其他地方出了岔子',
];

const CLUTCH_LOSS_LINES = [
  '{clutchWins} 个关键分没浪费，{playerName} 已经拼尽全力，输得不丢人',
  '关键时刻顶住了 {clutchWins} 次，但 {oppName} 今天更顶，下次见！',
];

const CLOSE_LOSS_LINES = [
  '1:2 惜败，就差那关键的几拍，{playerName} 复仇的火已经点燃',
  '这盘分太近了！{playerName} 下次不会给 {oppName} 这种机会',
  '决胜盘差点翻盘，{playerName} 今天的表现已经超出预期',
];

const CRUSHING_LOSS_LINES = [
  '0:2 完败，{oppName} 今天确实打出了神级表现，不服不行',
  '今天 {oppName} 状态爆炸，{playerName} 先去吃点好的再来挑战！',
  '{playerName} 今天遇到了克星——下次换个时间再战，风水轮流转',
];

function fill(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
}

function pickFrom(arr, vars) {
  return fill(arr[Math.floor(Math.random() * arr.length)], vars);
}

/**
 * 根据对局数据返回一句赛后点评。
 * @param {object} params
 * @param {string} params.playerName
 * @param {string} params.oppName
 * @param {string} params.playerFace
 * @param {boolean} params.playerWon
 * @param {number} params.setsP
 * @param {number} params.setsO
 * @param {number} [params.aces=0]
 * @param {number} [params.clutchWins=0]
 * @param {number} [params.countersWon=0]
 * @returns {string}
 */
export function getPostMatchCommentary({
  playerName, oppName, playerFace,
  playerWon, setsP, setsO,
  aces = 0, clutchWins = 0, countersWon = 0,
}) {
  const vars = { playerName, oppName, playerFace, aces, clutchWins, countersWon, setsP, setsO };

  if (playerWon) {
    if (aces >= 3) return pickFrom(ACE_WIN_LINES, vars);
    if (clutchWins >= 3) return pickFrom(CLUTCH_WIN_LINES, vars);
    if (countersWon >= 3) return pickFrom(COUNTER_WIN_LINES, vars);

    const pool = [...GENERIC_WIN_LINES];
    if (setsP === 2 && setsO === 0) pool.push(...SWEEP_LINES);
    if (setsP === 2 && setsO === 1) pool.push(...COMEBACK_LINES);
    const charPool = CHAR_WIN_QUIPS[playerName];
    if (charPool) pool.push(...charPool);
    return pickFrom(pool, vars);
  }

  if (aces >= 2) return pickFrom(ACE_LOSS_LINES, vars);
  if (clutchWins >= 2) return pickFrom(CLUTCH_LOSS_LINES, vars);

  const pool = [];
  if (setsP === 1 && setsO === 2) pool.push(...CLOSE_LOSS_LINES);
  if (setsP === 0 && setsO === 2) pool.push(...CRUSHING_LOSS_LINES);
  const charPool = CHAR_LOSS_QUIPS[playerName];
  if (charPool) pool.push(...charPool);
  if (!pool.length) pool.push(`${playerFace} ${playerName} 今天有点背，下次一定能赢！`);
  return pickFrom(pool, vars);
}
