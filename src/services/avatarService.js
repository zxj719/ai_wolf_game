/**
 * 头像服务
 * 从数据库获取预生成的头像
 */

import { getPlaceholderAvatar } from './imageGenerator';
import { buildApiUrl } from './apiBase';

/**
 * 批量获取玩家头像
 * @param {Array} players - 玩家数组 [{ name, role }, ...]
 * @returns {Promise<Object>} { name: imageUrl, ... }
 */
export async function fetchAvatarsBatch(players) {
  try {
    const response = await fetch(buildApiUrl('/api/avatars/batch'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ players })
    });

    if (!response.ok) {
      console.warn('[AvatarService] API 请求失败:', response.status);
      return {};
    }

    const data = await response.json();
    if (data.success) {
      console.log(`[AvatarService] 获取到 ${data.count} 个头像`);
      return data.avatars;
    }

    return {};
  } catch (error) {
    console.warn('[AvatarService] 获取头像失败:', error.message);
    return {};
  }
}

/**
 * 为玩家列表分配头像
 * 优先使用数据库预生成头像，否则使用占位符
 *
 * @param {Array} players - 玩家数组
 * @param {string} gameMode - 游戏模式
 * @returns {Promise<Array>} 带头像的玩家数组
 */
export async function assignPlayerAvatars(players, gameMode) {
  console.log('[AvatarService] 开始分配头像...');

  // 1. 尝试从数据库获取头像
  const avatarsFromDB = await fetchAvatarsBatch(
    players.map(p => ({ name: p.name, role: p.role }))
  );

  // 2. 为每个玩家分配头像
  const playersWithAvatars = players.map(player => {
    // 优先使用数据库头像
    if (avatarsFromDB[player.name]) {
      return {
        ...player,
        avatarUrl: avatarsFromDB[player.name]
      };
    }

    // 否则使用占位符
    // 玩家模式下使用中性占位符，AI模式下使用角色占位符
    const placeholder = gameMode === 'ai-only'
      ? getPlaceholderAvatar(player.role)
      : getPlaceholderAvatar('neutral');

    return {
      ...player,
      avatarUrl: placeholder
    };
  });

  const dbCount = Object.keys(avatarsFromDB).length;
  console.log(`[AvatarService] 分配完成: ${dbCount} 个来自数据库, ${players.length - dbCount} 个使用占位符`);

  return playersWithAvatars;
}

/**
 * 获取单个头像
 * @param {string} name - 玩家名称
 * @param {string} role - 角色类型
 * @returns {Promise<string>} 头像 URL
 */
export async function fetchSingleAvatar(name, role) {
  try {
    const response = await fetch(buildApiUrl(`/api/avatars?names=${encodeURIComponent(name)}&role=${encodeURIComponent(role)}`));

    if (!response.ok) {
      return getPlaceholderAvatar(role);
    }

    const data = await response.json();
    if (data.success && data.avatars[name] && data.avatars[name][role]) {
      return data.avatars[name][role];
    }

    return getPlaceholderAvatar(role);
  } catch (error) {
    console.warn('[AvatarService] 获取单个头像失败:', error.message);
    return getPlaceholderAvatar(role);
  }
}
