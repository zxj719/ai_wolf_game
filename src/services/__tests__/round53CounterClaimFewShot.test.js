/**
 * Round 53: 验证本轮两项优化
 * 1. promptFactory.js 已删除（整体死代码清理）
 * 2. 预言家对跳三步法 few-shot 示例已添加
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../../..');
const aiPromptsSrc = readFileSync(path.join(ROOT, 'src/services/aiPrompts.js'), 'utf8');
const seerSrc = readFileSync(path.join(ROOT, 'src/services/rolePrompts/seer.js'), 'utf8');

describe('R53: promptFactory.js 删除验证', () => {
  it('T1: promptFactory.js 文件已不存在', () => {
    const pf = path.join(ROOT, 'src/services/promptFactory.js');
    expect(existsSync(pf)).toBe(false);
  });

  it('T2: 任何生产源文件均未 import promptFactory', () => {
    // grep -rn "promptFactory" src/ --include="*.js" --include="*.jsx"
    // (如有 import，构建会 fail；此测试为代码库级别的额外验证)
    const prompt = aiPromptsSrc.includes('promptFactory');
    const seer = seerSrc.includes('promptFactory');
    expect(prompt).toBe(false);
    expect(seer).toBe(false);
  });

  it('T3: rolePrompts/index.js 不 re-export promptFactory', () => {
    const indexSrc = readFileSync(path.join(ROOT, 'src/services/rolePrompts/index.js'), 'utf8');
    expect(indexSrc.includes('promptFactory')).toBe(false);
  });
});

describe('R53: 预言家对跳 few-shot 示例验证', () => {
  // 定位 counterClaimSection 代码块
  const ccIdx = aiPromptsSrc.lastIndexOf('counterClaimSection = `');
  const ccBlock = aiPromptsSrc.slice(ccIdx, ccIdx + 2500);

  it('T4: 对跳 Section 包含 Step A', () => {
    expect(ccBlock.includes('Step A')).toBe(true);
  });

  it('T5: 对跳 Section 包含 Step B', () => {
    expect(ccBlock.includes('Step B')).toBe(true);
  });

  it('T6: 对跳 Section 包含 Step C', () => {
    expect(ccBlock.includes('Step C')).toBe(true);
  });

  it('T7: 对跳 Section 包含 few-shot 执行示例标注', () => {
    expect(ccBlock.includes('执行示例')).toBe(true);
  });

  it('T8: few-shot 示例包含错误写法对比', () => {
    expect(ccBlock.includes('错误写法')).toBe(true);
  });

  it('T9: few-shot 示例包含正确写法对比', () => {
    expect(ccBlock.includes('正确写法')).toBe(true);
  });

  it('T10: few-shot 示例体现 Step A→B→C 执行顺序', () => {
    expect(ccBlock.includes('Step A→B→C')).toBe(true);
  });

  it('T11: 正确示例包含查验记录结构（N夜/好人/狼人）', () => {
    expect(ccBlock.includes('N1夜')).toBe(true);
    expect(ccBlock.includes('N2夜')).toBe(true);
  });

  it('T12: 正确示例包含矛盾点指出（Step B 体现）', () => {
    expect(ccBlock.includes('直接矛盾')).toBe(true);
  });

  it('T13: 正确示例包含心路历程提问（Step C 体现）', () => {
    expect(ccBlock.includes('查验心路历程') || ccBlock.includes('什么判断依据')).toBe(true);
  });

  it('T14: few-shot 块的指导文本不含 JS 变量插值（白熊效应防护）', () => {
    // 找"执行示例"行并检查到下一换行
    const exIdx = ccBlock.indexOf('执行示例（few-shot）');
    const lineEnd = ccBlock.indexOf('\n', exIdx);
    const exLine = ccBlock.slice(exIdx, lineEnd);
    // 该行不应有 ${someVar} 形式（ccIds 是合理插值，允许）
    // 检查没有多余的变量名插值
    expect(exLine.includes('${ccIds}')).toBe(true); // ccIds 是允许的动态变量
    // 行中不应出现其他非 ccIds 的 ${} 插值模式（静态文本区应无其他 ${}）
    const otherInterpolations = exLine.replace('${ccIds}', '').match(/\$\{[^}]+\}/g);
    expect(otherInterpolations).toBeNull();
  });
});

describe('R53: seer.js thinkingDimensions 与降级路径同步验证', () => {
  it('T15: seer.js dimension[1] 包含三步法描述', () => {
    expect(seerSrc.includes('Step A')).toBe(true);
    expect(seerSrc.includes('Step B')).toBe(true);
    expect(seerSrc.includes('Step C')).toBe(true);
  });

  it('T16: aiPrompts.js ROLE_PERSONAS 预言家降级路径也包含三步法', () => {
    const personaIdx = aiPromptsSrc.indexOf("'预言家': {");
    const personaBlock = aiPromptsSrc.slice(personaIdx, personaIdx + 800);
    expect(personaBlock.includes('Step A')).toBe(true);
    expect(personaBlock.includes('Step B')).toBe(true);
    expect(personaBlock.includes('Step C')).toBe(true);
  });
});
