#!/usr/bin/env node
/**
 * scripts/analyze-games.js — 本地游戏日志分析工具
 *
 * 用法：
 *   node scripts/analyze-games.js                        # 拉最近20局，用 LLM 分析
 *   node scripts/analyze-games.js --limit 50             # 指定局数
 *   node scripts/analyze-games.js --version 1.0.0        # 只看某版本
 *   node scripts/analyze-games.js --stats                # 只看胜率统计，不调 LLM
 *   node scripts/analyze-games.js --ask "狼人为什么总输" # 自定义分析问题
 *   node scripts/analyze-games.js --save                 # 把分析结果保存到 docs/
 *
 * 依赖环境变量：
 *   BT_API_URL   — ECS 地址，默认 https://bt.zhaxiaoji.com
 *   ANALYSIS_KEY — 调用分析 LLM 的 API Key（默认读 .env 的 VITE_API_KEY）
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');

// ── 读取 .env（简单解析，不依赖 dotenv）──────────────────
function loadEnv() {
  try {
    const raw = readFileSync(resolve(ROOT, '.env'), 'utf-8');
    const env = {};
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m) env[m[1]] = m[2].trim();
    }
    return env;
  } catch { return {}; }
}

const ENV         = loadEnv();
const BT_URL      = process.env.BT_API_URL  || 'https://bt.zhaxiaoji.com';
const API_KEY     = process.env.ANALYSIS_KEY || ENV.VITE_API_KEY || '';
const API_URL     = 'https://api-inference.modelscope.cn/v1/chat/completions';
const ANALYSIS_MODEL = 'Qwen/Qwen3-235B-A22B-Instruct-2507';

// ── CLI 参数解析 ──────────────────────────────────────────
const args    = process.argv.slice(2);
const limit   = parseInt(args[args.indexOf('--limit')   + 1] || '20');
const version = args[args.indexOf('--version') + 1] || null;
const ask     = args.includes('--ask') ? args[args.indexOf('--ask') + 1] : null;
const statsOnly = args.includes('--stats');
const save    = args.includes('--save');

// ── 主流程 ───────────────────────────────────────────────
async function main() {
  console.log(`\n🔍 连接 BT Server: ${BT_URL}`);

  // 1. 胜率统计
  const stats = await fetchJson('/bt/stats');
  console.log('\n📊 各版本胜率：');
  console.table(stats);

  if (statsOnly) return;

  // 2. 拉取游戏日志
  const url = `/bt/export?limit=${limit}${version ? `&version=${version}` : ''}`;
  console.log(`\n⬇️  拉取最近 ${limit} 局日志...`);
  const games = await fetchJson(url);
  console.log(`   共 ${games.length} 局（${games.filter(g => g.winner_team === 'wolf').length} 局狼胜 / ${games.filter(g => g.winner_team === 'villager').length} 局民胜）`);

  if (games.length === 0) {
    console.log('\n⚠️  暂无已结束的游戏记录。');
    return;
  }

  // 3. 格式化为 LLM 可读的摘要
  const summary = formatGamesForLLM(games);

  // 4. 调用 LLM 分析
  if (!API_KEY) {
    console.log('\n⚠️  未找到 API Key（ANALYSIS_KEY 或 VITE_API_KEY），跳过 LLM 分析。');
    console.log('\n原始摘要：\n', summary);
    return;
  }

  const question = ask || '请分析狼人阵营和好人阵营各自的策略表现，指出最明显的弱点，并给出具体的行为树优化建议（包括建议修改的文件和参数）。';

  console.log(`\n🤖 调用 LLM 分析（${ANALYSIS_MODEL}）...`);
  const analysis = await callLLM(summary, question);

  console.log('\n' + '─'.repeat(60));
  console.log('📝 分析报告');
  console.log('─'.repeat(60));
  console.log(analysis);
  console.log('─'.repeat(60));

  // 5. 可选：保存到 docs/
  if (save) {
    const date    = new Date().toISOString().slice(0, 10);
    const outPath = resolve(ROOT, `docs/game-analysis-${date}.md`);
    const content = `# 游戏 AI 分析报告\n\n**日期**：${date}  \n**样本**：${games.length} 局  \n**版本**：${version || '全部'}  \n\n## 问题\n\n${question}\n\n## 分析\n\n${analysis}\n\n## 胜率统计\n\n${JSON.stringify(stats, null, 2)}\n`;
    writeFileSync(outPath, content, 'utf-8');
    console.log(`\n✅ 报告已保存：${outPath}`);
  }
}

// ── 格式化日志为 LLM 输入 ────────────────────────────────
function formatGamesForLLM(games) {
  const lines = [`共 ${games.length} 局游戏日志摘要：\n`];

  for (const g of games) {
    lines.push(`## 游戏 ${g.id} [${g.ai_version}] → ${g.winner_team ?? '未结束'} 胜`);
    lines.push(`配置：${g.player_count}人，${g.wolf_count}狼`);

    // 策略分布
    const strategies = {};
    for (const d of g.decisions) {
      if (d.strategy) strategies[d.strategy] = (strategies[d.strategy] || 0) + 1;
    }
    if (Object.keys(strategies).length) {
      lines.push(`决策策略：${JSON.stringify(strategies)}`);
    }

    // 狼人发言策略
    const wolfSpeeches = g.speeches.filter(s => s.role === '狼人');
    if (wolfSpeeches.length) {
      const wolfStrats = wolfSpeeches.map(s => s.strategy).filter(Boolean);
      lines.push(`狼人发言策略：${wolfStrats.join(' → ')}`);
    }

    lines.push('');
  }

  // 策略胜率统计
  const stratWins   = {};
  const stratTotal  = {};
  for (const g of games) {
    for (const s of g.speeches.filter(r => r.role === '狼人' && r.strategy)) {
      const st = s.strategy;
      stratTotal[st] = (stratTotal[st] || 0) + 1;
      if (g.winner_team === 'wolf') stratWins[st] = (stratWins[st] || 0) + 1;
    }
  }
  if (Object.keys(stratTotal).length) {
    lines.push('## 狼人策略胜率');
    for (const [st, total] of Object.entries(stratTotal)) {
      const wins = stratWins[st] || 0;
      lines.push(`  ${st}: ${wins}/${total} (${Math.round(100*wins/total)}%)`);
    }
  }

  return lines.join('\n');
}

// ── HTTP 工具 ─────────────────────────────────────────────
async function fetchJson(path) {
  const res = await fetch(BT_URL + path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

async function callLLM(context, question) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      messages: [
        { role: 'system', content: '你是一名 AI 游戏设计师，专门分析狼人杀 AI 的行为树策略，给出具体可执行的优化建议。' },
        { role: 'user',   content: `以下是游戏日志：\n\n${context}\n\n问题：${question}` },
      ],
      max_tokens: 1500,
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '（无响应）';
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
