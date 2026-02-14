import { ROLE_DEFINITIONS } from '../config/roles';
import { logger } from './logger';

/**
 * 检查游戏是否结束
 * @returns {'good_win' | 'wolf_win' | null}
 */
export function checkGameEnd(currentPlayers, victoryMode, addLog, setGameResult) {
  const aliveWolves = currentPlayers.filter(p => p.isAlive && p.role === ROLE_DEFINITIONS.WEREWOLF).length;
  const aliveVillagers = currentPlayers.filter(p => p.isAlive && p.role === ROLE_DEFINITIONS.VILLAGER).length;
  const aliveGods = currentPlayers.filter(p => p.isAlive && (p.role !== '狼人' && p.role !== '村民')).length;

  logger.debug(`[GameCheck] Mode: ${victoryMode}, Wolves: ${aliveWolves}, Villagers: ${aliveVillagers}, Gods: ${aliveGods}, Check State:`, currentPlayers.map(p => `${p.id}:${p.role[0]}:${p.isAlive?'alive':'dead'}`).join(','));

  const aliveGood = aliveVillagers + aliveGods;

  // 好人胜利条件（两种模式相同）：狼人全灭
  if (aliveWolves === 0) {
    addLog("🎉 狼人全灭，好人胜利！", "success");
    setGameResult('good_win');
    return 'good_win';
  }

  // 狼人胜利条件：根据模式不同
  if (victoryMode === 'edge') {
    // 屠边模式：村民全灭或神职全灭
    if (aliveVillagers === 0) {
      addLog("💀 村民全灭，狼人胜利（屠边）！", "danger");
      setGameResult('wolf_win');
      return 'wolf_win';
    }
    if (aliveGods === 0) {
      addLog("💀 神职全灭，狼人胜利（屠边）！", "danger");
      setGameResult('wolf_win');
      return 'wolf_win';
    }
  } else if (victoryMode === 'town') {
    // 屠城模式：所有好人（村民+神职）全灭
    if (aliveGood === 0) {
      addLog("💀 好人全灭，狼人胜利（屠城）！", "danger");
      setGameResult('wolf_win');
      return 'wolf_win';
    }
  }

  // 通用条件：狼人数量 >= 好人数量
  if (aliveWolves >= aliveGood) {
    addLog("💀 狼人数量大于等于好人，狼人胜利！", "danger");
    setGameResult('wolf_win');
    return 'wolf_win';
  }
  return null;
}

/**
 * 判断好人是否占多数
 */
export function isGoodMajority(currentPlayers) {
  const aliveWolves = currentPlayers.filter(p => p.isAlive && p.role === ROLE_DEFINITIONS.WEREWOLF).length;
  const aliveGood = currentPlayers.filter(p => p.isAlive && p.role !== ROLE_DEFINITIONS.WEREWOLF).length;
  return aliveGood > aliveWolves;
}

/**
 * 根据 ID 查找玩家
 */
export function getPlayer(players, id) {
  return players.find(p => p.id === id);
}

/**
 * 判断当前夜间步骤是否轮到用户操作
 */
export function isUserTurn(userPlayer, nightStep, nightSequence) {
  const roles = nightSequence;
  return userPlayer?.isAlive && userPlayer.role === ROLE_DEFINITIONS[roles[nightStep]];
}

/**
 * 获取当前夜间阶段的角色名
 */
export function getCurrentNightRole(nightStep, nightSequence) {
  const roles = nightSequence.map(key => ROLE_DEFINITIONS[key]);
  return roles[nightStep] || '';
}
