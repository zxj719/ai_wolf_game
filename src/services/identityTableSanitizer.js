const UNKNOWN_ROLE = '未知';

const getRoleCountsFromSetup = (gameSetup) => {
  const roles = gameSetup?.STANDARD_ROLES;
  if (!Array.isArray(roles) || roles.length === 0) return {};

  return roles.reduce((acc, role) => {
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});
};

const normalizePlayerIdKey = (rawKey) => {
  const keyStr = String(rawKey ?? '').trim();
  if (!keyStr) return null;

  const match = keyStr.match(/\d+/);
  if (!match) return null;
  return match[0];
};

const normalizeSuspectRole = (suspect, { rolePool, rolePoolSet }) => {
  if (typeof suspect !== 'string') return UNKNOWN_ROLE;

  const text = suspect.trim();
  if (!text) return UNKNOWN_ROLE;

  // Already valid
  if (rolePoolSet.has(text)) return text;

  const goodRoles = rolePool.filter(r => r !== '狼人');

  let goodHint = false;
  let wolfHint = false;

  // Collect explicitly mentioned roles (only those in the role pool)
  const candidates = new Set();
  rolePool.forEach(role => {
    if (role && text.includes(role)) candidates.add(role);
  });

  // Common category / synonym hints
  if (text.includes('平民') || text.includes('村民') || text.includes('好人') || text.includes('神职') || text.includes('神')) {
    goodHint = true;
  }
  if (text.includes('坏人')) {
    wolfHint = true;
  }
  // "狼" is ambiguous but usually means "狼人"
  if (text.includes('狼')) {
    wolfHint = true;
  }

  // If villager is not part of the pool but the model used "村民/平民",
  // map it to the remaining good role(s) instead of keeping an invalid label.
  if (!rolePoolSet.has('村民') && (text.includes('平民') || text.includes('村民'))) {
    if (goodRoles.length === 1) {
      candidates.add(goodRoles[0]);
    } else if (goodRoles.length > 1 && wolfHint) {
      // Preserve ambiguity like “村民/狼人” -> “(所有好人角色)/狼人”
      goodRoles.forEach(r => candidates.add(r));
    }
  }

  // Fallback: category -> role pool
  if (candidates.size === 0) {
    if (wolfHint && rolePoolSet.has('狼人')) {
      candidates.add('狼人');
    } else if (goodHint) {
      // Only map generic "good" to a single role when there is exactly one good role.
      if (goodRoles.length === 1) candidates.add(goodRoles[0]);
    }
  }

  const result = [...candidates].filter(r => rolePoolSet.has(r));
  if (result.length === 0) return UNKNOWN_ROLE;
  if (result.length === 1) return result[0];
  return result.join('或');
};

const clampConfidence = (value) => {
  if (value === null || value === undefined) return undefined;
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return undefined;
  return Math.max(0, Math.min(100, Math.round(num)));
};

/**
 * 强制修正 AI 返回的 identity_table，避免出现“本局不存在的角色”等幻觉。
 * - key 统一为纯数字字符串（避免 0号/玩家0 等）
 * - suspect 只能从 role pool 中选，否则修正为 UNKNOWN_ROLE / 或映射到唯一好人角色
 */
export const sanitizeIdentityTable = (identityTable, { players = [], gameSetup = null } = {}) => {
  if (!identityTable || typeof identityTable !== 'object') return { identityTable, changed: false };

  const validPlayerIds = new Set(players.map(p => String(p.id)));
  const roleCounts = getRoleCountsFromSetup(gameSetup);
  const rolePool = Object.keys(roleCounts);
  const rolePoolSet = new Set(rolePool);

  // If setup is missing, do not aggressively rewrite.
  if (rolePool.length === 0) return { identityTable, changed: false };

  let changed = false;
  const sanitized = {};

  Object.entries(identityTable).forEach(([rawKey, rawValue]) => {
    const normalizedKey = normalizePlayerIdKey(rawKey);
    if (!normalizedKey) return;
    if (validPlayerIds.size > 0 && !validPlayerIds.has(normalizedKey)) return;

    const value = rawValue && typeof rawValue === 'object' ? rawValue : {};

    const next = { ...value };

    const nextSuspect = normalizeSuspectRole(value.suspect, { rolePool, rolePoolSet });
    if (nextSuspect !== value.suspect) {
      next.suspect = nextSuspect;
      changed = true;
    }

    const nextConfidence = clampConfidence(value.confidence);
    if (nextConfidence !== undefined && nextConfidence !== value.confidence) {
      next.confidence = nextConfidence;
      changed = true;
    }

    sanitized[normalizedKey] = next;
    if (normalizedKey !== rawKey) changed = true;
  });

  return { identityTable: sanitized, changed };
};

