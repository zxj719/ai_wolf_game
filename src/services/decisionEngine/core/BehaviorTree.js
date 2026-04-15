/**
 * BehaviorTree 运行时
 *
 * 使用：
 *   const tree = new BehaviorTree(villagerVoteTree);
 *   const decision = tree.run(blackboard);
 */
export class BehaviorTree {
  constructor(rootNode) {
    this.root = rootNode;
  }

  /**
   * 执行一次决策
   * @param {Object} bb - Blackboard（含 state，可变的 decision/trace 会被写入）
   * @returns {Object|null} 决策结果 bb.decision，若无决策则 null
   */
  run(bb) {
    bb.trace = bb.trace ?? [];
    bb.decision = bb.decision ?? null;
    const started = performance.now();
    const ok = this.root.tick(bb);
    const elapsed = performance.now() - started;
    bb.trace.push(`[耗时 ${elapsed.toFixed(2)}ms] 根节点=${ok ? 'SUCCESS' : 'FAILURE'}`);
    return bb.decision;
  }
}
