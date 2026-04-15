/**
 * Behavior Tree 原语节点
 *
 * 约定：每个节点的 tick(bb) 返回 true/false
 *   - true  = SUCCESS（条件成立 / 动作已执行）
 *   - false = FAILURE（条件不成立 / 动作未选中）
 *
 * Blackboard (bb) 是可变的共享黑板：
 *   - bb.state     — 只读游戏状态（buildBlackboard 构造）
 *   - bb.decision  — 决策输出（{ targetId, reasoning, path }）
 *   - bb.trace     — 节点执行轨迹（用于调试）
 */

export const STATUS = { SUCCESS: true, FAILURE: false };

// ────────────────────────────────────────────────
// 组合节点（Composites）
// ────────────────────────────────────────────────

/**
 * Selector（OR）：依次尝试子节点，任一成功即返回 SUCCESS；全部失败才 FAILURE
 */
export const selector = (name, children) => ({
  kind: 'selector',
  name,
  children,
  tick(bb) {
    bb.trace?.push(`→ Selector(${name})`);
    for (const child of children) {
      if (child.tick(bb)) return true;
    }
    return false;
  }
});

/**
 * Sequence（AND）：依次执行子节点，任一失败即返回 FAILURE；全部成功才 SUCCESS
 */
export const sequence = (name, children) => ({
  kind: 'sequence',
  name,
  children,
  tick(bb) {
    bb.trace?.push(`→ Sequence(${name})`);
    for (const child of children) {
      if (!child.tick(bb)) return false;
    }
    return true;
  }
});

// ────────────────────────────────────────────────
// 叶子节点（Leaves）
// ────────────────────────────────────────────────

/**
 * Condition：纯判断。check(bb) → boolean
 */
export const condition = (name, check) => ({
  kind: 'condition',
  name,
  tick(bb) {
    const ok = check(bb);
    bb.trace?.push(`  ${ok ? '✓' : '✗'} ${name}`);
    return ok;
  }
});

/**
 * Action：副作用节点。exec(bb) → boolean
 *   - 返回 true 表示动作执行成功（通常会写入 bb.decision）
 *   - 返回 false 表示动作条件不满足（例如目标池为空）
 */
export const action = (name, exec) => ({
  kind: 'action',
  name,
  tick(bb) {
    const ok = exec(bb);
    bb.trace?.push(`  ${ok ? '▶' : '✗'} ${name}`);
    return ok;
  }
});

// ────────────────────────────────────────────────
// 装饰器（Decorators） — 暂留简单两个
// ────────────────────────────────────────────────

/**
 * 反转子节点结果
 */
export const inverter = (child) => ({
  kind: 'inverter',
  name: `!${child.name}`,
  tick(bb) { return !child.tick(bb); }
});

/**
 * 无论子节点成功失败都返回 SUCCESS（用于可选副作用）
 */
export const succeeder = (child) => ({
  kind: 'succeeder',
  name: `?${child.name}`,
  tick(bb) { child.tick(bb); return true; }
});
