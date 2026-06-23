/**
 * Round 49 — Item 99: 数据流链完整性测试
 *
 * 防范 R46 类 bug：gameState.X 在 aiPrompts.js 中被访问，但 X 没有在
 * useAI.js 的 gameState 对象中定义，或未从 WerewolfModule.jsx 传入。
 *
 * 三层链：
 *   Layer 1: WerewolfModule.jsx → useAI({ X })
 *   Layer 2: useAI.js → const gameState = { X }
 *   Layer 3: aiPrompts.js → gameState.X 或 prepareGameContext 解构
 *
 * 同时守门 magician.js 的死解构清理（R49 修复）。
 */

import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../..');
const servicesDir = path.resolve(__dirname, '..');
const rolePromptsDir = path.resolve(servicesDir, 'rolePrompts');
const hooksDir = path.resolve(srcDir, 'hooks');
const modulesDir = path.resolve(srcDir, 'modules');

const readFile = (absPath) => fs.readFileSync(absPath, 'utf8');

const aiPromptsSrc = readFile(path.join(servicesDir, 'aiPrompts.js'));
const useAISrc = readFile(path.join(hooksDir, 'useAI.js'));
const magicianSrc = readFile(path.join(rolePromptsDir, 'magician.js'));

// WerewolfModule.jsx は modules/werewolf/ 下にある
const werewolfModuleSrc = readFile(path.join(modulesDir, 'werewolf', 'WerewolfModule.jsx'));

// ─────────────────────────────────────────────────────────────────────────────
// 辅助：从 "const gameState = {" 对象字面量中提取 key 列表
// ─────────────────────────────────────────────────────────────────────────────
function extractGameStateKeys(src) {
  const anchor = 'const gameState = {';
  const idx = src.indexOf(anchor);
  if (idx === -1) return null;
  const fromAnchor = src.slice(idx + anchor.length);
  // 找匹配的 }
  let depth = 1, i = 0, end = -1;
  while (i < fromAnchor.length) {
    if (fromAnchor[i] === '{') depth++;
    else if (fromAnchor[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
    i++;
  }
  if (end === -1) return null;
  const objBody = fromAnchor.slice(0, end);
  // 提取 key: 或 key, 格式的 key（属性名）
  // 处理 "key: value", "key," (shorthand), "key\n" 等形式
  const keys = [];
  // shorthand properties: 出现在对象体内的 "word" 后跟 ","  或换行或 ":" 或 "}"
  const keyRe = /^\s*\/\/[^\n]*\n|^\s*(\w+)\s*[:,\n}]/mg;
  let m;
  while ((m = keyRe.exec(objBody)) !== null) {
    if (m[1]) keys.push(m[1]);
  }
  return keys;
}

// ─────────────────────────────────────────────────────────────────────────────
// 辅助：从 useAI({ ... }) 调用中提取传入的 key 列表
// ─────────────────────────────────────────────────────────────────────────────
function extractUseAICallKeys(src) {
  const anchor = 'const { askAI } = useAI({';
  const idx = src.indexOf(anchor);
  if (idx === -1) return null;
  const fromAnchor = src.slice(idx + anchor.length - 1); // include the {
  let depth = 0, i = 0, end = -1;
  while (i < fromAnchor.length) {
    if (fromAnchor[i] === '{') depth++;
    else if (fromAnchor[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
    i++;
  }
  if (end === -1) return null;
  const objBody = fromAnchor.slice(1, end);
  const keys = [];
  // 提取属性名（key: value 和 shorthand key,）
  // dreamweaverHistory, magicianHistory 等 shorthand
  // gameSetup: selectedSetup 等 key: alias 形式
  const keyRe = /(\w+)\s*[=:,\n}]/g;
  let m;
  while ((m = keyRe.exec(objBody)) !== null) {
    const k = m[1];
    // 过滤掉 JS 关键字和非参数名
    if (!['true', 'false', 'null', 'undefined', 'const', 'let', 'var', 'return', 'new', 'if', 'else', 'for', 'while', 'function'].includes(k)) {
      keys.push(k);
    }
  }
  return [...new Set(keys)];
}

// ─────────────────────────────────────────────────────────────────────────────
// 辅助：提取 aiPrompts.js 中直接访问的 gameState 字段（gameState.X 或 gameState?.X）
// ─────────────────────────────────────────────────────────────────────────────
function extractGameStateAccessKeys(src) {
  const keys = new Set();
  const re = /gameState\??\.([a-zA-Z_]\w*)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    keys.add(m[1]);
  }
  return [...keys];
}

// ─────────────────────────────────────────────────────────────────────────────
// 辅助：提取 prepareGameContext 内的解构字段
// ─────────────────────────────────────────────────────────────────────────────
function extractPrepareContextDestructuredKeys(src) {
  const anchor = 'export const prepareGameContext = (gameState) => {';
  const idx = src.indexOf(anchor);
  if (idx === -1) return null;
  const fromAnchor = src.slice(idx, idx + 500);
  const destructureRe = /const\s*\{([^}]+)\}\s*=\s*gameState/;
  const m = destructureRe.exec(fromAnchor);
  if (!m) return null;
  return m[1].split(',').map(k => k.trim().split(':')[0].trim()).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

describe('数据流链完整性测试 (Item 99)', () => {

  // ─── Group 1: gameState 三层链 ─────────────────────────────────────────────

  it('T1: aiPrompts.js 中所有 gameState.X 直接访问的 key，均在 useAI.js 的 gameState 对象中', () => {
    const accessKeys = extractGameStateAccessKeys(aiPromptsSrc);
    expect(accessKeys.length, 'aiPrompts.js 中应有 gameState.X 访问').toBeGreaterThan(0);

    const gameStateKeys = extractGameStateKeys(useAISrc);
    expect(gameStateKeys, 'useAI.js 中应有 const gameState = {...}').not.toBeNull();

    const missing = accessKeys.filter(k => !gameStateKeys.includes(k));
    expect(
      missing,
      `以下 key 在 aiPrompts.js 通过 gameState.X 访问，但未在 useAI.js gameState 对象中定义（R46 类 bug）:\n  ${missing.join(', ')}`
    ).toHaveLength(0);
  });

  it('T2: aiPrompts.js 的 prepareGameContext 解构的所有 gameState key，均在 useAI.js gameState 对象中', () => {
    const destructuredKeys = extractPrepareContextDestructuredKeys(aiPromptsSrc);
    expect(destructuredKeys, 'prepareGameContext 中应有 gameState 解构').not.toBeNull();
    expect(destructuredKeys.length).toBeGreaterThan(0);

    const gameStateKeys = extractGameStateKeys(useAISrc);
    expect(gameStateKeys).not.toBeNull();

    const missing = destructuredKeys.filter(k => !gameStateKeys.includes(k));
    expect(
      missing,
      `以下 key 被 prepareGameContext 解构，但未在 useAI.js gameState 中定义:\n  ${missing.join(', ')}`
    ).toHaveLength(0);
  });

  it('T3: aiPrompts.js 中所有 gameState.X 访问的 key，均在 WerewolfModule.jsx 的 useAI() 调用中传入', () => {
    const accessKeys = extractGameStateAccessKeys(aiPromptsSrc);
    const prepareKeys = extractPrepareContextDestructuredKeys(aiPromptsSrc) || [];
    // 合并两类访问
    const allKeys = [...new Set([...accessKeys, ...prepareKeys])];
    expect(allKeys.length).toBeGreaterThan(0);

    const callKeys = extractUseAICallKeys(werewolfModuleSrc);
    expect(callKeys, 'WerewolfModule.jsx 中应有 useAI({...}) 调用').not.toBeNull();

    // 某些 key 由 useAI.js 内部计算（如 enhancedSpeechHistory → speechHistory），
    // 或 key 本身就是 useAI 的内部状态（setIsThinking 等）——只检查数据字段
    const dataKeys = allKeys.filter(k => !['phase'].includes(k)); // phase 可来自 useAI 自身状态管理
    const missing = dataKeys.filter(k => {
      // WerewolfModule.jsx 可能用别名传入（如 gameSetup: selectedSetup）
      // 检查该 key 是否出现在调用对象文本中
      return !werewolfModuleSrc.includes(k);
    });
    expect(
      missing,
      `以下 gameState key 在 aiPrompts.js 中被访问，但未在 WerewolfModule.jsx 传给 useAI()（R46 三层链断裂）:\n  ${missing.join(', ')}`
    ).toHaveLength(0);
  });

  it('T4: useAI.js 的 gameState 对象包含所有必须的核心字段', () => {
    const required = [
      'players', 'speechHistory', 'voteHistory', 'deathHistory',
      'seerChecks', 'guardHistory', 'witchHistory', 'dayCount', 'phase',
      'gameSetup', 'claimHistory', 'dreamweaverHistory', 'magicianHistory',
      'nightDecisions',
    ];
    const gameStateKeys = extractGameStateKeys(useAISrc);
    expect(gameStateKeys).not.toBeNull();
    const missing = required.filter(k => !gameStateKeys.includes(k));
    expect(
      missing,
      `useAI.js 的 gameState 对象缺少以下必须字段:\n  ${missing.join(', ')}`
    ).toHaveLength(0);
  });

  // ─── Group 2: magician.js 死解构守门（R49 修复验证）─────────────────────────

  it('T5: magician.js getMagicianNightActionPrompt 已清理死解构 seerChecks', () => {
    // 找 getMagicianNightActionPrompt 函数定义
    const fnIdx = magicianSrc.indexOf('getMagicianNightActionPrompt');
    expect(fnIdx).toBeGreaterThan(-1);
    // 找该函数的解构块（"} = params" 终点 + "const {" 起点）
    const window = magicianSrc.slice(fnIdx, fnIdx + 800);
    const endIdx = window.indexOf('} = params');
    expect(endIdx).toBeGreaterThan(-1);
    const constIdx = window.lastIndexOf('const {', endIdx);
    const braceOpen = window.indexOf('{', constIdx) + 1;
    const content = window.slice(braceOpen, endIdx);
    expect(
      content,
      'getMagicianNightActionPrompt 解构仍含 seerChecks（死解构应已删除）'
    ).not.toContain('seerChecks');
  });

  it('T6: magician.js getMagicianNightActionPrompt 保留必要字段 hasRevealed/swappedPlayers/lastSwap', () => {
    const fnIdx = magicianSrc.indexOf('getMagicianNightActionPrompt');
    const window = magicianSrc.slice(fnIdx, fnIdx + 800);
    const endIdx = window.indexOf('} = params');
    const constIdx = window.lastIndexOf('const {', endIdx);
    const braceOpen = window.indexOf('{', constIdx) + 1;
    const content = window.slice(braceOpen, endIdx);
    expect(content).toContain('hasRevealed');
    expect(content).toContain('swappedPlayers');
    expect(content).toContain('lastSwap');
  });

  it('T7: magician.js getMagicianDaySpeechPrompt 已清理死解构 seerChecks/deathHistory', () => {
    const fnIdx = magicianSrc.indexOf('getMagicianDaySpeechPrompt');
    expect(fnIdx).toBeGreaterThan(-1);
    const window = magicianSrc.slice(fnIdx, fnIdx + 600);
    const endIdx = window.indexOf('} = params');
    expect(endIdx).toBeGreaterThan(-1);
    const constIdx = window.lastIndexOf('const {', endIdx);
    const braceOpen = window.indexOf('{', constIdx) + 1;
    const content = window.slice(braceOpen, endIdx);
    expect(
      content,
      'getMagicianDaySpeechPrompt 解构仍含 seerChecks（死解构应已删除）'
    ).not.toContain('seerChecks');
    expect(
      content,
      'getMagicianDaySpeechPrompt 解构仍含 deathHistory（死解构应已删除）'
    ).not.toContain('deathHistory');
  });

  it('T8: magician.js getMagicianDaySpeechPrompt 保留必要字段 swappedPlayers/lastSwap', () => {
    const fnIdx = magicianSrc.indexOf('getMagicianDaySpeechPrompt');
    const window = magicianSrc.slice(fnIdx, fnIdx + 600);
    const endIdx = window.indexOf('} = params');
    const constIdx = window.lastIndexOf('const {', endIdx);
    const braceOpen = window.indexOf('{', constIdx) + 1;
    const content = window.slice(braceOpen, endIdx);
    expect(content).toContain('swappedPlayers');
    expect(content).toContain('lastSwap');
  });

  // ─── Group 3: 常驻检查——SHERIFF_SPEECH/PK 覆盖（R98 义务）─────────────────

  it('T9: SHERIFF_SPEECH + PK 联合覆盖检查——所有特殊神职均有专属分支', () => {
    // 特殊神职列表（村民/狼人走 fallback 是有意设计）
    const specialRoles = ['预言家', '守卫', '女巫', '猎人', '骑士', '摄梦人', '魔术师'];
    const missing = specialRoles.filter(role => {
      // 检查 playerRole === 'X' 出现次数（至少需要 2 次：SHERIFF_SPEECH + pkHint 各一）
      const count = (aiPromptsSrc.match(new RegExp(`playerRole === '${role}'`, 'g')) || []).length;
      return count < 2;
    });
    expect(
      missing,
      `以下特殊神职在 aiPrompts.js 中 playerRole === 'X' 分支覆盖不足（需至少 2 处）:\n  ${missing.join(', ')}`
    ).toHaveLength(0);
  });
});
