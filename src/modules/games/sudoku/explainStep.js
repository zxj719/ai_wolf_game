import { getPeers, totalDoF } from './sudokuEngine';

/**
 * 推理面板文案 — 通过 diff 相邻两个候选值快照来生成逐步数学解释，
 * 而不是在求解过程中额外记录来源信息。从原始可视化工具移植并译成中文。
 */

function rcLabel(r, c) {
  return `R${r + 1}C${c + 1}`;
}

function fmtCellList(arr, max) {
  if (arr.length === 0) return '';
  if (arr.length <= max) return arr.map((p) => rcLabel(p.row, p.col)).join('、');
  return arr.slice(0, max).map((p) => rcLabel(p.row, p.col)).join('、') + `，等 ${arr.length - max} 个`;
}

export function explainStep({ step, currentSnap, prevSnap, grid }) {
  const meta = currentSnap.meta;

  const dofText = () => {
    const before = totalDoF(prevSnap), after = totalDoF(currentSnap), delta = after - before;
    return `剩余候选值：${before} → ${after}（${delta >= 0 ? '+' : ''}${delta}）`;
  };
  const peersLostValue = (row, col, value) => getPeers(row, col).filter((p) => {
    const before = prevSnap.candidates[p.row][p.col], after = currentSnap.candidates[p.row][p.col];
    return before.includes(value) && !after.includes(value);
  });

  if (step === -1) {
    let clues = 0;
    for (const row of grid) for (const v of row) if (v !== 0) clues++;
    return {
      title: '开始',
      colorVar: 'var(--ink-muted)',
      dofText: `首轮传播后剩余候选值总数：${totalDoF(currentSnap)}`,
      lines: [
        `已放置 ${clues} 个已知数。其余每个格子起始都持有全部 9 个候选值 {1..9}。`,
        `每个已知数会传播一次：从它的每个"同伴"格子（同行、同列、同宫，共 20 个）的候选集里剔除。`,
      ],
    };
  }
  if (meta.type === 'naked_single') {
    const affected = peersLostValue(meta.row, meta.col, meta.value);
    return {
      title: '唯一余数',
      colorVar: 'var(--success)',
      dofText: dofText(),
      lines: [
        `${rcLabel(meta.row, meta.col)} 的候选值已收窄到只剩一个：${meta.value}。其余 8 个数字已被更早的同伴约束逐一排除——候选集大小为 1，直接确定取值。`,
        affected.length
          ? `落定 ${rcLabel(meta.row, meta.col)} = ${meta.value} 后，从 ${affected.length} 个同伴格子中移除了 ${meta.value}：${fmtCellList(affected, 6)}。`
          : `没有同伴格子还列着 ${meta.value}，因此这次落子不再引发新的消去。`,
      ],
    };
  }
  if (meta.type === 'hidden_single') {
    const ownBefore = prevSnap.candidates[meta.row][meta.col];
    const affected = peersLostValue(meta.row, meta.col, meta.value);
    const unitLabel = { row: '行', col: '列', box: '宫' }[meta.unitType] ?? meta.unitType;
    const lines = [
      `扫描第 ${meta.unitIndex + 1} ${unitLabel}：9 个格子里只有 ${rcLabel(meta.row, meta.col)} 还把 ${meta.value} 列为候选值——同一单元内其余格子都已排除它。`,
    ];
    if (ownBefore.length > 1) lines.push(`<i>注意：这一步之前 ${rcLabel(meta.row, meta.col)} 自己还列着 {${ownBefore.join(',')}}，并不是唯一余数——是整个单元内的计数逼出了这个结果，仅看单个格子会漏掉这一步。</i>`);
    if (affected.length) lines.push(`落定 ${rcLabel(meta.row, meta.col)} = ${meta.value} 后，从 ${affected.length} 个同伴格子中移除了它：${fmtCellList(affected, 6)}。`);
    return { title: '隐性唯一', colorVar: 'var(--state-thinking)', dofText: dofText(), lines };
  }
  if (meta.type === 'guess') {
    return {
      title: `试探猜测 · 深度 ${meta.depth}`,
      colorVar: 'var(--warning)',
      dofText: dofText(),
      lines: [
        `传播已经停滞：棋盘上再也找不到唯一余数或隐性唯一了。`,
        `${rcLabel(meta.row, meta.col)} 是所有未解格子里候选值最少的（${meta.optionsCount} 个）——最少候选值（MRV）启发式优先在这里分支，因为猜错时会最快暴露矛盾，剪枝效果最好。`,
        `尝试 ${meta.value}（候选中第 ${[...prevSnap.candidates[meta.row][meta.col]].indexOf(meta.value) + 1} / ${meta.optionsCount} 个）。之后若出现矛盾，求解器会精确地回到这一步尝试下一个选项。`,
      ],
    };
  }
  if (meta.type === 'backtrack') {
    return {
      title: `回溯 · 深度 ${meta.depth}`,
      colorVar: 'var(--danger)',
      dofText: dofText(),
      lines: [
        `猜测 ${rcLabel(meta.row, meta.col)} = ${meta.value} 在更深的搜索里最终导致了矛盾。`,
        `自这次猜测以来的每一个候选值与落子都被恢复到之前的精确状态——求解器只需要保留每个猜测点的快照，不需要手动维护撤销日志，因为下一状态完全由当前状态决定。`,
        `接下来：为 ${rcLabel(meta.row, meta.col)} 尝试下一个候选值。`,
      ],
    };
  }
  if (meta.type === 'contradiction') {
    return {
      title: '矛盾',
      colorVar: 'var(--danger)',
      dofText: dofText(),
      lines: [
        `${rcLabel(meta.row, meta.col)} 刚刚失去了最后一个候选值。候选集为空意味着 1-9 里没有一个数字能合法填入这里。`,
        `这条分支立即被放弃——没必要在一条已经死掉的分支里继续找唯一余数。`,
      ],
    };
  }
  if (meta.type === 'solved') {
    return {
      title: '已求解',
      colorVar: 'var(--success)',
      dofText: '剩余候选值：0',
      lines: [
        `全部 81 个格子都只剩一个候选值，且根据构造过程，每行、每列、每宫都恰好各出现一次 1-9。`,
      ],
    };
  }
  return { title: '', colorVar: 'var(--ink-muted)', dofText: '', lines: [] };
}
