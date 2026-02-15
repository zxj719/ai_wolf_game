// Role and game setup configuration
export const ROLE_DEFINITIONS = {
  WEREWOLF: '狼人',
  VILLAGER: '村民',
  SEER: '预言家',
  WITCH: '女巫',
  HUNTER: '猎人',
  GUARD: '守卫',
  MAGICIAN: '魔术师',
  KNIGHT: '骑士',
  DREAMWEAVER: '摄梦人'
};

// 角色元数据 - 定义每个角色的约束和夜间顺序
export const ROLE_METADATA = {
  WEREWOLF: {
    key: 'WEREWOLF',
    name: '狼人',
    maxCount: 10,
    nightOrder: 3,
    nightAction: true,
    camp: 'wolf',
    description: '每晚可袭击一名玩家'
  },
  VILLAGER: {
    key: 'VILLAGER',
    name: '村民',
    maxCount: 10,
    nightOrder: null,
    nightAction: false,
    camp: 'good',
    description: '无特殊技能'
  },
  SEER: {
    key: 'SEER',
    name: '预言家',
    maxCount: 1,
    nightOrder: 4,
    nightAction: true,
    camp: 'good',
    description: '每晚可查验一人身份'
  },
  WITCH: {
    key: 'WITCH',
    name: '女巫',
    maxCount: 1,
    nightOrder: 5,
    nightAction: true,
    camp: 'good',
    description: '拥有解药和毒药各一瓶'
  },
  HUNTER: {
    key: 'HUNTER',
    name: '猎人',
    maxCount: 10,
    nightOrder: null,
    nightAction: false,
    camp: 'good',
    description: '死亡时可带走一人'
  },
  GUARD: {
    key: 'GUARD',
    name: '守卫',
    maxCount: 1,
    nightOrder: 1,
    nightAction: true,
    camp: 'good',
    description: '每晚可守护一人'
  },
  MAGICIAN: {
    key: 'MAGICIAN',
    name: '魔术师',
    maxCount: 1,
    nightOrder: 2,
    nightAction: true,
    camp: 'good',
    description: '每晚可交换两人，重定向所有技能'
  },
  KNIGHT: {
    key: 'KNIGHT',
    name: '骑士',
    maxCount: 1,
    nightOrder: null,
    nightAction: false,
    camp: 'good',
    description: '白天可决斗一名玩家，整局一次'
  },
  DREAMWEAVER: {
    key: 'DREAMWEAVER',
    name: '摄梦人',
    maxCount: 1,
    nightOrder: 2.5,
    nightAction: true,
    camp: 'good',
    description: '每晚必须入梦一人，免疫刀毒，连梦必死，同生共死'
  }
};

// 角色分类
export const UNIQUE_ROLES = ['SEER', 'WITCH', 'GUARD', 'MAGICIAN', 'KNIGHT', 'DREAMWEAVER'];
export const MULTI_ROLES = ['WEREWOLF', 'VILLAGER', 'HUNTER'];

// 根据角色选择生成夜间行动顺序
export function generateNightSequence(roleSelections) {
  return Object.entries(ROLE_METADATA)
    .filter(([key, meta]) => meta.nightAction && (roleSelections[key] || 0) > 0)
    .sort((a, b) => a[1].nightOrder - b[1].nightOrder)
    .map(([key]) => key);
}

// 生成配置描述字符串（如 "2狼 2民 1预 1女"）
export function generateDescription(roleSelections) {
  const shortNames = {
    WEREWOLF: '狼',
    VILLAGER: '民',
    SEER: '预',
    WITCH: '女',
    HUNTER: '猎',
    GUARD: '守',
    MAGICIAN: '术',
    KNIGHT: '骑',
    DREAMWEAVER: '摄'
  };
  const roleOrder = ['WEREWOLF', 'VILLAGER', 'SEER', 'WITCH', 'HUNTER', 'GUARD', 'MAGICIAN', 'KNIGHT', 'DREAMWEAVER'];

  return roleOrder
    .filter(key => (roleSelections[key] || 0) > 0)
    .map(key => `${roleSelections[key]}${shortNames[key]}`)
    .join(' ');
}

// 从选择构建角色数组
export function buildRolesArray(roleSelections) {
  const roles = [];
  Object.entries(roleSelections).forEach(([key, count]) => {
    for (let i = 0; i < count; i++) {
      roles.push(ROLE_DEFINITIONS[key]);
    }
  });
  return roles;
}

// 验证规则常量
export const VALIDATION_RULES = {
  MIN_PLAYERS: 4,
  MAX_PLAYERS: 10,
  MIN_WEREWOLVES: 1
};

// 验证角色配置
export function validateRoleConfig(roleSelections) {
  const errors = [];
  const warnings = [];

  const total = Object.values(roleSelections).reduce((a, b) => a + b, 0);
  const wolves = roleSelections.WEREWOLF || 0;
  const good = total - wolves;

  // 错误验证（阻止开始游戏）
  if (total < VALIDATION_RULES.MIN_PLAYERS) {
    errors.push(`至少需要 ${VALIDATION_RULES.MIN_PLAYERS} 名玩家`);
  }
  if (total > VALIDATION_RULES.MAX_PLAYERS) {
    errors.push(`最多支持 ${VALIDATION_RULES.MAX_PLAYERS} 名玩家`);
  }
  if (wolves < VALIDATION_RULES.MIN_WEREWOLVES) {
    errors.push('至少需要 1 名狼人');
  }
  if (good <= wolves) {
    errors.push('好人数量必须多于狼人');
  }

  // 唯一角色检查
  UNIQUE_ROLES.forEach(role => {
    if ((roleSelections[role] || 0) > 1) {
      errors.push(`${ROLE_METADATA[role].name}最多只能有 1 个`);
    }
  });

  // 警告验证（可以开始但可能不平衡）
  if (wolves > Math.floor(total / 3) && total >= VALIDATION_RULES.MIN_PLAYERS) {
    warnings.push('狼人比例偏高，游戏可能不平衡');
  }
  if ((roleSelections.SEER || 0) === 0 && (roleSelections.WITCH || 0) === 0) {
    warnings.push('建议至少有一个查验类神职');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    total,
    wolves,
    good
  };
}

// 默认自定义配置
export const DEFAULT_CUSTOM_SELECTIONS = {
  WEREWOLF: 2,
  VILLAGER: 2,
  SEER: 1,
  WITCH: 1,
  HUNTER: 1,
  GUARD: 1
};

// 自定义模式（唯一模式）：不提供 6/8 人等预设局。
// 但仍保留一份“默认自定义配置”，作为 UI 初始值。
export const STANDARD_ROLES = buildRolesArray(DEFAULT_CUSTOM_SELECTIONS);

export const GAME_SETUPS = [
  {
    id: 'custom',
    name: '自定义局',
    TOTAL_PLAYERS: STANDARD_ROLES.length,
    STANDARD_ROLES: STANDARD_ROLES,
    NIGHT_SEQUENCE: generateNightSequence(DEFAULT_CUSTOM_SELECTIONS),
    description: generateDescription(DEFAULT_CUSTOM_SELECTIONS),
    isCustom: true
  }
];

export const PERSONALITIES = [
  { type: 'logical', name: '逻辑怪', traits: '严谨冷静，通过投票记录和发言矛盾找狼，理性分析。' },
  { type: 'aggressive', name: '暴躁哥', traits: '直觉敏锐，攻击性强，怀疑划水者。' },
  { type: 'steady', name: '稳健派', traits: '发言平和，倾向于保护神职，不轻易带节奏。' },
  { type: 'cunning', name: '心机王', traits: '善于伪装和误导，喜欢带节奏和引导舆论。' }
];

export const NAMES = ['Harry', 'Hermione', 'Ron', 'Draco', 'Luna', 'Neville', 'Ginny', 'Snape', 'Dumbledore', 'Hagrid', 'Sirius', 'McGonagall'];

// 胜利模式配置
export const VICTORY_MODES = {
  EDGE: {
    id: 'edge',
    name: '屠边模式',
    description: '杀光所有村民或所有神职，狼人胜利',
    wolfWinConditions: ['村民全灭', '神职全灭', '狼人数量≥好人'],
    goodWinCondition: '狼人全灭'
  },
  TOWN: {
    id: 'town',
    name: '屠城模式',
    description: '杀光所有好人（村民+神职），狼人胜利',
    wolfWinConditions: ['所有好人全灭', '狼人数量≥好人'],
    goodWinCondition: '狼人全灭'
  }
};

export const DEFAULT_VICTORY_MODE = 'edge';

export const DEFAULT_TOTAL_PLAYERS = STANDARD_ROLES.length;
