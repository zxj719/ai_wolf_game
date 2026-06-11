/**
 * tennisLib.js — 家庭网球公开赛战绩校验（纯逻辑，便于 vitest）
 *
 * 服务端校验是排行榜可信度的唯一防线：客户端任何数值都可伪造，
 * 这里只拦「结构非法」的提交（比分形态、角色白名单、反应时间下限），
 * 家庭娱乐场景不做更重的反作弊。
 */

// 与前端 src/modules/tennis/gameData.js 的 CHARS 保持一致
export const TENNIS_CHARS = {
  '诚': '🐯',
  'Elza': '🦊',
  '菲比': '🐰',
  'Ross': '🦖',
  '铁蛋': '🍳',
  '丫': '🐱',
  '莹': '🦢',
};

const GRADES = new Set(['S', 'A', 'B', 'C']);
const FACES = new Set(Object.values(TENNIS_CHARS));

/**
 * 校验并归一化一条战绩。
 * @returns {{ok: true, record: object} | {ok: false, error: string}}
 */
export function validateTennisRecord(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid body' };
  }

  const character = body.character;
  const opponent = body.opponent;
  if (!(character in TENNIS_CHARS)) {
    return { ok: false, error: 'Unknown character' };
  }
  if (!(opponent in TENNIS_CHARS)) {
    return { ok: false, error: 'Unknown opponent' };
  }
  if (character === opponent) {
    return { ok: false, error: 'Character and opponent must differ' };
  }

  const setsWon = body.setsWon;
  const setsLost = body.setsLost;
  const validSet = (n) => Number.isInteger(n) && n >= 0 && n <= 2;
  // 三局两胜：恰有一方拿到 2 盘，另一方少于 2 盘
  if (!validSet(setsWon) || !validSet(setsLost) ||
      (setsWon === 2) === (setsLost === 2)) {
    return { ok: false, error: 'Invalid set score' };
  }

  let reactionMs = body.reactionMs;
  if (reactionMs !== null && reactionMs !== undefined) {
    if (!Number.isInteger(reactionMs) || reactionMs < 80 || reactionMs > 60000) {
      return { ok: false, error: 'Invalid reactionMs' };
    }
  } else {
    reactionMs = null;
  }

  const grade = body.grade;
  if (!GRADES.has(grade)) {
    return { ok: false, error: 'Invalid grade' };
  }

  // face 只接受白名单 emoji，否则回退到角色默认 face（防注入脏数据）
  const characterFace = FACES.has(body.characterFace)
    ? body.characterFace : TENNIS_CHARS[character];
  const opponentFace = FACES.has(body.opponentFace)
    ? body.opponentFace : TENNIS_CHARS[opponent];

  return {
    ok: true,
    record: { character, characterFace, opponent, opponentFace, setsWon, setsLost, reactionMs, grade },
  };
}
