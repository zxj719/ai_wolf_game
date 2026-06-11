/**
 * achievements.js — 成就定义（id 必须与 workers/auth/tennisProgressLib.js 白名单一致）
 */

export const ACHIEVEMENTS = [
  { id: 'firstWin',        icon: '🎉', name: '首胜',       desc: '赢下第一场比赛' },
  { id: 'familyKing',      icon: '👑', name: '家族球王',   desc: '家族挑战 6 连胜加冕' },
  { id: 'allUltimates',    icon: '📖', name: '绝技全图鉴', desc: '集齐 7 张家人绝技' },
  { id: 'sGrade',          icon: '⚡', name: 'S 级天赋',   desc: '反应测试达到 S 级' },
  { id: 'perfectChampion', icon: '💎', name: '零失盘夺冠', desc: '家族挑战全程不丢一盘' },
  { id: 'adventureClear',  icon: '🗺️', name: '夺回奖杯',   desc: '通关奇幻闯关' },
  { id: 'firstLegendary',  icon: '🌟', name: '传说装备',   desc: '首次获得传说品质装备' },
  { id: 'aceMaster',       icon: '🚀', name: 'ACE 大师',   desc: '单场轰出 3 记 ACE' },
];

export const achievementById = (id) => ACHIEVEMENTS.find((a) => a.id === id);
