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
  { id: 'clutchMaster',    icon: '🧊', name: '关键先生',   desc: '关键分坚持挑战过关并赢下该分' },
  { id: 'boxOpener',       icon: '🎁', name: '开盒手气',   desc: '首次在商店开盲盒' },
  { id: 'goldRush',        icon: '⛏️', name: '黄金矿工',   desc: '矿工盒单次挖到 60 分以上' },
  { id: 'aviator',         icon: '🐦', name: '飞行执照',   desc: '飞翔的网球难度等级达到 5' },
  { id: 'consecAce',       icon: '🔥', name: '发球炮台',   desc: '单场连续轰出 3 记以上 ACE' },
  { id: 'winStreak5',      icon: '🌊', name: '势如破竹',   desc: '单场连续赢球 5 次以上' },
  { id: 'proTouch',        icon: '✨', name: '神之触感',   desc: '小游戏操作倍率达到 1.4 以上' },
  { id: 'allChars',        icon: '🌈', name: '全能选手',   desc: '用所有 7 位家人各赢一场' },
];

export const achievementById = (id) => ACHIEVEMENTS.find((a) => a.id === id);
