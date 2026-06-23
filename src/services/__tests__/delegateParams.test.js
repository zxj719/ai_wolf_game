/**
 * Round 48 — Item 100: 委托模式参数合同静态检查
 *
 * 防范 R46 类 bug：aiPrompts.js 向委托函数传 params，但委托函数未解构该 key，
 * 导致特性静默失效（无运行时错误，AI 行为错误但无报警）。
 *
 * 检查对象：
 *   - NIGHT_MAGICIAN → getMagicianNightActionPrompt (magician.js)
 *   - 骑士 daySpeech → getKnightDaySpeechPrompt (knight.js) 死解构清理验证
 *   - 摄梦人 daySpeech → getDreamweaverDaySpeechPrompt (dreamweaver.js) 死解构清理验证
 */

import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const servicesDir = path.resolve(__dirname, '..');
const rolePromptsDir = path.resolve(servicesDir, 'rolePrompts');

const readSrc = (relPath) => fs.readFileSync(path.resolve(servicesDir, relPath), 'utf8');
const readRole = (file) => fs.readFileSync(path.join(rolePromptsDir, file), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// 辅助：从函数参数解构块中提取 key 列表
// 支持单行 "const { a, b } = params" 和多行格式；
// 用 "} = params" 定位终点，再往前找 "const {" 确定起点，
// 避免与函数体 "{" 混淆（R48 修复：旧 regex 匹配了函数体 { 导致误判）
// ─────────────────────────────────────────────────────────────────────────────
function extractDestructuredKeys(src, anchorStr) {
  const idx = src.indexOf(anchorStr);
  if (idx === -1) return null;
  const window = src.slice(idx, idx + 800);
  // 找 "} = params" 定位解构块终点
  const endIdx = window.indexOf('} = params');
  if (endIdx === -1) return null;
  // 往前找最近的 "const {" 或 "let {" 作为解构块起点
  const constIdx = window.lastIndexOf('const {', endIdx);
  const letIdx = window.lastIndexOf('let {', endIdx);
  const startIdx = Math.max(constIdx, letIdx);
  if (startIdx === -1) return null;
  // 找开括号 { 的位置（在 const/let 之后）
  const braceOpen = window.indexOf('{', startIdx) + 1;
  const content = window.slice(braceOpen, endIdx);
  return content.split(',').map(k => {
    // 去除行注释 "// ..."
    const withoutComment = k.replace(/\/\/[^\n]*/g, '');
    return withoutComment.trim().split(':')[0].trim();
  }).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// 辅助：从 aiPrompts.js case 块中提取传给委托函数的 key 列表
// ─────────────────────────────────────────────────────────────────────────────
function extractPassedKeys(src, caseAnchor, delegateCallAnchor) {
  const caseIdx = src.indexOf(caseAnchor);
  if (caseIdx === -1) return null;
  const afterCase = src.slice(caseIdx, caseIdx + 2000);
  const callIdx = afterCase.indexOf(delegateCallAnchor);
  if (callIdx === -1) return null;
  // 找对象字面量 { key: value, ... }
  const fromCall = afterCase.slice(callIdx);
  const objStart = fromCall.indexOf('{');
  if (objStart === -1) return null;
  // 找匹配的 }
  let depth = 0, i = objStart, end = -1;
  while (i < fromCall.length) {
    if (fromCall[i] === '{') depth++;
    else if (fromCall[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    i++;
  }
  if (end === -1) return null;
  const objStr = fromCall.slice(objStart + 1, end);
  // 提取 key: ... 格式的 key
  const keys = [];
  const keyRe = /^\s*(\w+)\s*:/mg;
  let m;
  while ((m = keyRe.exec(objStr)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

describe('委托模式参数合同静态检查 (Item 100)', () => {
  const aiPromptsSrc = readSrc('aiPrompts.js');
  const magicianSrc = readRole('magician.js');
  const knightSrc = readRole('knight.js');
  const dreamweaverSrc = readRole('dreamweaver.js');

  // ───── T1: NIGHT_MAGICIAN 传入的 key 与 getMagicianNightActionPrompt 解构一致 ─────
  it('T1: NIGHT_MAGICIAN 所有传给 nightAction 的 key 均被 getMagicianNightActionPrompt 解构', () => {
    const passedKeys = extractPassedKeys(
      aiPromptsSrc,
      'case PROMPT_ACTIONS.NIGHT_MAGICIAN',
      'magicianModule.nightAction({'
    );
    expect(passedKeys, '未找到 NIGHT_MAGICIAN 传参对象').not.toBeNull();

    const destructuredKeys = extractDestructuredKeys(magicianSrc, 'getMagicianNightActionPrompt');
    expect(destructuredKeys, '未找到 getMagicianNightActionPrompt 解构').not.toBeNull();

    const unresolved = passedKeys.filter(k => !destructuredKeys.includes(k));
    expect(unresolved, `以下 key 传给 magician.nightAction 但未被解构（R46 类 bug）: ${unresolved.join(', ')}`).toHaveLength(0);
  });

  // ───── T2: getMagicianNightActionPrompt 解构了 hasRevealed (R46 修复验证) ─────
  it('T2: getMagicianNightActionPrompt 解构列表含 hasRevealed (R46 修复)', () => {
    const destructuredKeys = extractDestructuredKeys(magicianSrc, 'getMagicianNightActionPrompt');
    expect(destructuredKeys).not.toBeNull();
    expect(destructuredKeys).toContain('hasRevealed');
  });

  // ───── T3: NIGHT_MAGICIAN 传了 hasRevealed (调用端正确) ─────
  it('T3: NIGHT_MAGICIAN case 传了 hasRevealed 给 nightAction', () => {
    const passedKeys = extractPassedKeys(
      aiPromptsSrc,
      'case PROMPT_ACTIONS.NIGHT_MAGICIAN',
      'magicianModule.nightAction({'
    );
    expect(passedKeys).not.toBeNull();
    expect(passedKeys).toContain('hasRevealed');
  });

  // ───── T4: knight.js getKnightDaySpeechPrompt 不含死解构 seerChecks/deathHistory/speechHistory ─────
  it('T4: knight.js getKnightDaySpeechPrompt 已清理死解构（无 deathHistory/speechHistory）', () => {
    const destructuredKeys = extractDestructuredKeys(knightSrc, 'getKnightDaySpeechPrompt');
    expect(destructuredKeys, '未找到 getKnightDaySpeechPrompt 解构').not.toBeNull();
    expect(destructuredKeys, 'deathHistory 仍在解构列表，应已删除').not.toContain('deathHistory');
    expect(destructuredKeys, 'speechHistory 仍在解构列表，应已删除').not.toContain('speechHistory');
  });

  // ───── T5: knight.js 解构中保留 hasUsedDuel ─────
  it('T5: getKnightDaySpeechPrompt 解构保留 hasUsedDuel', () => {
    const destructuredKeys = extractDestructuredKeys(knightSrc, 'getKnightDaySpeechPrompt');
    expect(destructuredKeys).not.toBeNull();
    expect(destructuredKeys).toContain('hasUsedDuel');
  });

  // ───── T6: dreamweaver.js getDreamweaverDaySpeechPrompt 无死解构 nightDeaths/seerChecks ─────
  it('T6: dreamweaver.js getDreamweaverDaySpeechPrompt 已清理死解构（无 nightDeaths/seerChecks）', () => {
    const destructuredKeys = extractDestructuredKeys(dreamweaverSrc, 'getDreamweaverDaySpeechPrompt');
    expect(destructuredKeys, '未找到 getDreamweaverDaySpeechPrompt 解构').not.toBeNull();
    expect(destructuredKeys, 'nightDeaths 仍在解构列表，应已删除').not.toContain('nightDeaths');
    expect(destructuredKeys, 'seerChecks 仍在解构列表，应已删除').not.toContain('seerChecks');
  });

  // ───── T7: dreamweaver.js getDreamweaverDaySpeechPrompt 保留 dreamHistory/lastDreamTarget ─────
  it('T7: getDreamweaverDaySpeechPrompt 解构保留 dreamHistory 和 lastDreamTarget', () => {
    const destructuredKeys = extractDestructuredKeys(dreamweaverSrc, 'getDreamweaverDaySpeechPrompt');
    expect(destructuredKeys).not.toBeNull();
    expect(destructuredKeys).toContain('dreamHistory');
    expect(destructuredKeys).toContain('lastDreamTarget');
  });

  // ───── T8: getDreamweaverNightPrompt 已从 dreamweaver.js 删除（R14 遗留死代码清理）─────
  it('T8: getDreamweaverNightPrompt 已从 dreamweaver.js 删除', () => {
    expect(dreamweaverSrc).not.toContain('getDreamweaverNightPrompt');
  });

  // ───── T9: DREAMWEAVER_PROMPTS 不再含 nightAction 字段 ─────
  it('T9: DREAMWEAVER_PROMPTS 不含 nightAction 键', () => {
    // 只检查 DREAMWEAVER_PROMPTS 的对象字面量范围
    const exportIdx = dreamweaverSrc.indexOf('export const DREAMWEAVER_PROMPTS');
    expect(exportIdx).toBeGreaterThan(-1);
    const exportBlock = dreamweaverSrc.slice(exportIdx, exportIdx + 300);
    expect(exportBlock).not.toContain('nightAction');
  });

  // ───── T10: aiPrompts.js NIGHT_DREAMWEAVER 是内联实现（不调用 nightAction 委托）─────
  it('T10: aiPrompts.js NIGHT_DREAMWEAVER case 是内联实现，无 nightAction 委托调用', () => {
    const caseIdx = aiPromptsSrc.indexOf('case PROMPT_ACTIONS.NIGHT_DREAMWEAVER');
    expect(caseIdx).toBeGreaterThan(-1);
    const caseBlock = aiPromptsSrc.slice(caseIdx, caseIdx + 100);
    expect(caseBlock).not.toContain('nightAction');
  });
});
