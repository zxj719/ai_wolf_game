// Role and game setup configuration
export const ROLE_DEFINITIONS = {
  WEREWOLF: '狼人',
  VILLAGER: '村民',
  SEER: '预言家',
  WITCH: '女巫',
  HUNTER: '猎人',
  GUARD: '守卫'
};

// 8-player default composition
export const STANDARD_ROLES = [
  ROLE_DEFINITIONS.WEREWOLF, ROLE_DEFINITIONS.WEREWOLF,
  ROLE_DEFINITIONS.SEER, ROLE_DEFINITIONS.WITCH,
  ROLE_DEFINITIONS.HUNTER, ROLE_DEFINITIONS.GUARD,
  ROLE_DEFINITIONS.VILLAGER, ROLE_DEFINITIONS.VILLAGER
];

export const GAME_SETUPS = [
  {
    id: 'standard_8',
    name: '8人标准局',
    TOTAL_PLAYERS: 8,
    STANDARD_ROLES: [
      ROLE_DEFINITIONS.WEREWOLF, ROLE_DEFINITIONS.WEREWOLF,
      ROLE_DEFINITIONS.SEER, ROLE_DEFINITIONS.WITCH,
      ROLE_DEFINITIONS.HUNTER, ROLE_DEFINITIONS.GUARD,
      ROLE_DEFINITIONS.VILLAGER, ROLE_DEFINITIONS.VILLAGER
    ],
    NIGHT_SEQUENCE: ['GUARD', 'WEREWOLF', 'SEER', 'WITCH'],
    description: '2狼 2民 1预 1女 1猎 1守'
  },
  {
    id: 'mini_6',
    name: '6人迷你局',
    TOTAL_PLAYERS: 6,
    STANDARD_ROLES: [
      ROLE_DEFINITIONS.WEREWOLF, ROLE_DEFINITIONS.WEREWOLF,
      ROLE_DEFINITIONS.SEER, ROLE_DEFINITIONS.WITCH,
      ROLE_DEFINITIONS.VILLAGER, ROLE_DEFINITIONS.VILLAGER
    ],
    NIGHT_SEQUENCE: ['WEREWOLF', 'SEER', 'WITCH'],
    description: '2狼 2民 1预 1女'
  }
];

export const PERSONALITIES = [
  { type: 'logical', name: '逻辑怪', traits: '严谨冷静，通过投票记录和发言矛盾找狼，理性分析。' },
  { type: 'aggressive', name: '暴躁哥', traits: '直觉敏锐，攻击性强，怀疑划水者。' },
  { type: 'steady', name: '稳健派', traits: '发言平和，倾向于保护神职，不轻易带节奏。' },
  { type: 'cunning', name: '心机王', traits: '善于伪装和误导，喜欢带节奏和引导舆论。' }
];

export const NAMES = ['阿强', '翠花', '小明', '老王', '杰克', '露西', '小红', '大刘'];

export const DEFAULT_TOTAL_PLAYERS = 8;
