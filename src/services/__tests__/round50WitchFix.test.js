/**
 * Round 50 — 女巫系统提示词双路径对齐 + NIGHT_WITCH 守卫感知修复
 *
 * R1 原本修复了 aiPrompts.js 的降级路径（ROLE_PERSONAS['女巫'].taboos），
 * 但 witch.js 主路径（buildWitchPersonaPrompt → WITCH_PERSONA.taboos）未同步。
 * 导致两条路径在 taboos 内容上分叉 49 轮。
 *
 * 本轮修复：
 * 1. witch.js WITCH_PERSONA.taboos: '首夜不救人' → '同一晚又救又毒', '盲毒好人' → '盲毒（逻辑不充分时用毒）'
 * 2. NIGHT_WITCH firstNight hint: 静态 → 守卫感知（有守卫→警告同守同救风险；无守卫→鼓励正常救人）
 */

import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const servicesDir = path.resolve(__dirname, '..');
const rolePromptsDir = path.resolve(servicesDir, 'rolePrompts');

const readFile = (absPath) => fs.readFileSync(absPath, 'utf8');

const witchSrc = readFile(path.join(rolePromptsDir, 'witch.js'));
const aiPromptsSrc = readFile(path.join(servicesDir, 'aiPrompts.js'));

// 精确定位 NIGHT_WITCH case 块（带花括号形式，绕过 getCOTTemplate 的假 case）
const nightWitchStart = aiPromptsSrc.indexOf("case PROMPT_ACTIONS.NIGHT_WITCH: {");
const nightWitchEnd = nightWitchStart > 0
    ? aiPromptsSrc.indexOf("\n        case PROMPT_ACTIONS.", nightWitchStart + 50)
    : -1;
const nightWitchBlock = nightWitchStart > 0 && nightWitchEnd > 0
    ? aiPromptsSrc.slice(nightWitchStart, nightWitchEnd)
    : '';

// 精确定位 ROLE_PERSONAS['女巫'] fallback 路径的 taboos
const rolePBackIdx = aiPromptsSrc.indexOf("'女巫':");
const rolePBlock = rolePBackIdx > 0 ? aiPromptsSrc.slice(rolePBackIdx, rolePBackIdx + 800) : '';

describe('Round 50 — 女巫 taboos 主路径修复', () => {
    it('T1: witch.js WITCH_PERSONA.taboos 不含 "首夜不救人"（旧错误 taboo）', () => {
        expect(witchSrc).not.toContain("'首夜不救人'");
    });

    it('T2: witch.js WITCH_PERSONA.taboos 包含 "同一晚又救又毒"（正确 taboo）', () => {
        expect(witchSrc).toContain("'同一晚又救又毒'");
    });

    it('T3: witch.js WITCH_PERSONA.taboos 不含 "盲毒好人"（旧表述）', () => {
        expect(witchSrc).not.toContain("'盲毒好人'");
    });

    it('T4: witch.js WITCH_PERSONA.taboos 包含 "盲毒（逻辑不充分时用毒）"（正确表述）', () => {
        expect(witchSrc).toContain("'盲毒（逻辑不充分时用毒）'");
    });

    it('T5: aiPrompts.js 降级路径 ROLE_PERSONAS 女巫 taboos 包含 "同一晚又救又毒"', () => {
        expect(rolePBlock).toContain('同一晚又救又毒');
    });

    it('T6: witch.js 主路径 taboos 与 aiPrompts.js 降级路径 taboos 一致（同守同救 + 盲毒描述）', () => {
        const witchPrimary = witchSrc.includes("'同一晚又救又毒'") && witchSrc.includes("'盲毒（逻辑不充分时用毒）'");
        const witchFallback = rolePBlock.includes('同一晚又救又毒') && rolePBlock.includes('盲毒（逻辑不充分时用毒）');
        expect(witchPrimary).toBe(true);
        expect(witchFallback).toBe(true);
    });
});

describe('Round 50 — NIGHT_WITCH 首夜守卫感知修复', () => {
    it('T7: NIGHT_WITCH case 块已被正确定位（非零长度）', () => {
        expect(nightWitchBlock.length).toBeGreaterThan(100);
    });

    it('T8: NIGHT_WITCH case 包含 witchExistingRoles.hasGuard（守卫检测）', () => {
        expect(nightWitchBlock).toContain('witchExistingRoles.hasGuard');
    });

    it('T9: NIGHT_WITCH 有守卫分支包含同守同救警告', () => {
        expect(nightWitchBlock).toContain('同守同救会导致目标死亡');
    });

    it('T10: NIGHT_WITCH 无守卫分支包含"无同守同救风险"提示', () => {
        expect(nightWitchBlock).toContain('无同守同救风险');
    });

    it('T11: NIGHT_WITCH 有守卫分支包含"例外：若被刀者是你自己，必须自救"（防止自死不救）', () => {
        expect(nightWitchBlock).toContain('若被刀者是你自己，必须自救');
    });

    it('T12: NIGHT_WITCH firstNight hint 不再是静态字符串（使用 witchExistingRoles 动态判断）', () => {
        // 旧版静态字符串的特征词不应出现（否则说明未修复）
        expect(nightWitchBlock).not.toContain('通常使用解药救人。⚠️ 重要：第一晚女巫可以自救');
    });

    it('T13: NIGHT_WITCH case 输出 schema 只有 usePoison，不含 poisonTarget（R3 保护）', () => {
        // 取最后一个 JSON 输出行
        const outputIdx = nightWitchBlock.lastIndexOf('输出:');
        expect(outputIdx).toBeGreaterThan(-1);
        const outputLine = nightWitchBlock.slice(outputIdx, nightWitchBlock.indexOf('\n', outputIdx) + 1);
        expect(outputLine).not.toContain('poisonTarget');
        expect(outputLine).toContain('usePoison');
    });
});

describe('Round 50 — 死解构扫描（剩余 rolePrompts/*.js 活函数）', () => {
    it('T14: seer.js buildSeerPersonaPrompt 参数 player/existingRoles/gameSetup 均在函数体中引用', () => {
        const fnIdx = witchSrc.indexOf; // Not using witchSrc here, let's use seer
        const seerSrc = readFile(path.join(rolePromptsDir, 'seer.js'));
        const fnStart = seerSrc.indexOf('export const buildSeerPersonaPrompt');
        expect(fnStart).toBeGreaterThan(-1);
        const fnBlock = seerSrc.slice(fnStart, fnStart + 800);
        expect(fnBlock).toContain('player.personality');
        expect(fnBlock).toContain('existingRoles');
        expect(fnBlock).toContain('gameSetup');
    });

    it('T15: guard.js buildGuardPersonaPrompt 参数 existingRoles 在函数体中引用（hasWitch 分支）', () => {
        const guardSrc = readFile(path.join(rolePromptsDir, 'guard.js'));
        const fnStart = guardSrc.indexOf('export const buildGuardPersonaPrompt');
        expect(fnStart).toBeGreaterThan(-1);
        const fnBlock = guardSrc.slice(fnStart, fnStart + 800);
        expect(fnBlock).toContain('existingRoles.hasWitch');
    });

    it('T16: hunter.js buildHunterPersonaPrompt 参数 existingRoles 在函数体中引用（hasSeer 分支）', () => {
        const hunterSrc = readFile(path.join(rolePromptsDir, 'hunter.js'));
        const fnStart = hunterSrc.indexOf('export const buildHunterPersonaPrompt');
        expect(fnStart).toBeGreaterThan(-1);
        const fnBlock = hunterSrc.slice(fnStart, fnStart + 600);
        expect(fnBlock).toContain('existingRoles');
    });

    it('T17: villager.js buildVillagerPersonaPrompt 参数 existingRoles 在函数体中引用（hasSeer 分支）', () => {
        const villagerSrc = readFile(path.join(rolePromptsDir, 'villager.js'));
        const fnStart = villagerSrc.indexOf('export const buildVillagerPersonaPrompt');
        expect(fnStart).toBeGreaterThan(-1);
        const fnBlock = villagerSrc.slice(fnStart, fnStart + 600);
        expect(fnBlock).toContain('existingRoles.hasSeer');
    });
});
