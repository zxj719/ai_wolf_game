/**
 * Werewolf agent skill registry — per-role, per-action skill descriptors.
 *
 * Only the descriptor matching the *current* player's role + actionType is
 * injected into the prompt. The model never sees the others. This is what
 * keeps role secrets private when many AI players share the same backend.
 *
 * A skill is a tiny prose block (Chinese, matching the in-game vocabulary)
 * that explains the legal mechanics and the strategic emphasis of *this
 * specific role's* version of *this specific action*. Strategic guidance is
 * advisory; legality lives in contracts.js.
 */

const SKILLS = {
  WEREWOLF: {
    DAY_SPEECH: '狼人白天发言：伪装好人 / 推动对队友有利的立场。绝不暴露狼队友身份。可设置 voteIntention 表达投票倾向，但 thought 中保留真实意图。',
    DAY_VOTE: '狼人白天投票：尽量集火真神或冲票推动局势，避免误投队友。targetId 必须是 params.validTargets 中的活人，或 -1 弃票（罕见）。',
    NIGHT_WOLF: '狼人刀人：从 legalTargets（活着的非狼）中选一人作为 targetId。优先级：神职 > 关键好人 > 普通村民。绝不可选自己或狼队友。',
    HUNTER_SHOOT: '狼人不会触发猎人开枪。',
  },
  SEER: {
    DAY_SPEECH: '预言家白天发言：决定是否跳出（公布身份+查验记录）。已查金水绝不能投。注意预言家对抗（可能有狼悍跳）。',
    DAY_VOTE: '预言家白天投票：绝不能投自己已查的金水（非狼）。优先冲票确认的查杀。',
    NIGHT_SEER: '预言家查验：从 legalTargets（params.validTargets）中选一名尚未查过的活人。优先查焦点位（发言模糊或站位关键的玩家）。',
    HUNTER_SHOOT: '预言家不会触发猎人开枪。',
  },
  WITCH: {
    DAY_SPEECH: '女巫白天发言：通常隐藏身份（除非被刀位需要起跳）。声称用药要谨慎，因为狼人会反推狼坑。',
    DAY_VOTE: '女巫白天投票：根据公开信息和昨晚被刀者推断，集火可疑狼人。',
    NIGHT_WITCH: '女巫用药：useSave=true 表示对今晚被刀者（params.dyingId）使用解药；usePoison=数字 表示毒杀某人，null 表示不毒。规则：(1) 不能同夜既救又毒；(2) 仅在 params.canSave=true 时 useSave 可为 true；(3) 仅在 params.hasPoison=true 时 usePoison 才能非 null；(4) usePoison 必须是 legalTargets 中的活人，且不能是自己。',
    HUNTER_SHOOT: '女巫不会触发猎人开枪。',
  },
  GUARD: {
    DAY_SPEECH: '守卫白天发言：通常隐藏身份。透露守人位置可能暴露。',
    DAY_VOTE: '守卫白天投票：基于公开信息和昨晚平安夜情况推断狼人。',
    NIGHT_GUARD: '守卫守护：targetId 是要守护的玩家 id，或 null 表示空守。规则：(1) 不能与昨晚相同（params.cannotGuard）；(2) 必须是活人；(3) 可以守自己。同守同救会让目标死亡。',
    HUNTER_SHOOT: '守卫不会触发猎人开枪。',
  },
  HUNTER: {
    DAY_SPEECH: '猎人白天发言：可适度暴露猎人身份施压。',
    DAY_VOTE: '猎人白天投票：正常基于推理投票。',
    HUNTER_SHOOT: '猎人开枪：你已死亡，必须开枪。shoot 必须为 true，targetId 必须是 params.aliveTargets 中的活人，且不能是自己。优先级：被查杀位 > 悍跳预言家 > 发言狼坑。',
  },
  VILLAGER: {
    DAY_SPEECH: '村民白天发言：基于公开信息分析狼坑，避免站错队。可表达明确的 voteIntention。',
    DAY_VOTE: '村民白天投票：从 params.validTargets 中选最像狼的玩家，或 -1 弃票。',
    HUNTER_SHOOT: '村民不会触发猎人开枪。',
  },
};

const ROLE_KEY_BY_LABEL = {
  '狼人': 'WEREWOLF',
  '预言家': 'SEER',
  '女巫': 'WITCH',
  '守卫': 'GUARD',
  '猎人': 'HUNTER',
  '村民': 'VILLAGER',
};

export function resolveRoleKey(roleLabel) {
  return ROLE_KEY_BY_LABEL[roleLabel] || null;
}

/**
 * Look up the single skill block for the current player + action. Returns
 * null if no skill is registered (the prompt composer will then omit the
 * skill section rather than guess).
 */
export function getSkill(roleLabel, actionType) {
  const key = resolveRoleKey(roleLabel);
  if (!key) return null;
  const bucket = SKILLS[key];
  return bucket?.[actionType] ?? null;
}

/**
 * For tests / introspection only. Do NOT inject the full registry into a
 * prompt — that would leak other roles' strategies to the current agent.
 */
export function listSkills() {
  return SKILLS;
}
