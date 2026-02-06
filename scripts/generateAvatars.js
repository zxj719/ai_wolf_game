#!/usr/bin/env node
/**
 * 头像生成脚本
 * 调用 AI API 生成预设角色头像并存入数据库
 *
 * 使用方法：
 * 1. 设置环境变量 SILICONFLOW_API_KEY
 * 2. 运行: node scripts/generateAvatars.js
 *
 * 可选参数：
 * --dry-run    只生成不存储
 * --role=狼人   只生成指定角色
 * --name=Harry 只生成指定名称
 */

const API_KEY = process.env.SILICONFLOW_API_KEY || process.env.VITE_API_KEY;
const API_URL = 'https://api.siliconflow.cn/v1/images/generations';
const D1_API_URL = process.env.D1_API_URL; // Cloudflare D1 API URL
const D1_API_TOKEN = process.env.D1_API_TOKEN; // Cloudflare API Token
const D1_DATABASE_ID = process.env.D1_DATABASE_ID;
const D1_ACCOUNT_ID = process.env.D1_ACCOUNT_ID;

// 角色和名称配置
const NAMES = ['Harry', 'Hermione', 'Ron', 'Draco', 'Luna', 'Neville', 'Ginny', 'Snape', 'Dumbledore', 'Hagrid', 'Sirius', 'McGonagall'];
const ROLES = ['狼人', '预言家', '女巫', '猎人', '守卫', '村民'];
const PERSONALITIES = ['logical', 'aggressive', 'steady', 'cunning'];

// 角色提示词
const ROLE_PROMPTS = {
  '狼人': 'A mysterious wolf character in dark cloak, red glowing eyes, fantasy art style, high quality portrait',
  '预言家': 'A wise elderly fortune teller with crystal ball, mystical aura, starry background, fantasy portrait',
  '女巫': 'A mysterious witch with potion bottles, purple magical aura, fantasy style portrait',
  '猎人': 'A rugged hunter with crossbow, forest background, determined expression, fantasy portrait',
  '守卫': 'A noble knight with shield and sword, protective stance, medieval armor, fantasy portrait',
  '村民': 'A friendly villager in casual clothes, warm smile, village background, fantasy portrait',
  'neutral': 'A mysterious hooded figure in medieval village, neutral expression, fantasy art portrait'
};

// 性格特征
const PERSONALITY_TRAITS = {
  'logical': ', analytical and serious expression',
  'aggressive': ', fierce and intimidating look',
  'steady': ', calm and composed demeanor',
  'cunning': ', sly and mysterious appearance'
};

// 模型配置
const MODELS = [
  'Kwai-Kolors/Kolors',
  'stabilityai/stable-diffusion-3-5-large',
  'black-forest-labs/FLUX.1-schnell'
];

/**
 * 生成单个头像
 */
async function generateAvatar(name, role, personality) {
  const nameHint = `Character named ${name}. `;
  const basePrompt = ROLE_PROMPTS[role] || ROLE_PROMPTS['neutral'];
  const trait = PERSONALITY_TRAITS[personality] || '';
  const prompt = `${nameHint}${basePrompt}${trait}, high quality digital art`;

  console.log(`  Generating: ${name} - ${role} - ${personality}`);
  console.log(`  Prompt: ${prompt.slice(0, 80)}...`);

  for (const model of MODELS) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          image_size: '512x512',
          num_inference_steps: 20,
          batch_size: 1,
        }),
      });

      if (!response.ok) {
        console.warn(`    Model ${model} failed: ${response.status}`);
        continue;
      }

      const result = await response.json();
      const imageUrl =
        result.images?.[0]?.url ||
        result.data?.[0]?.url ||
        (result.data?.[0]?.b64_json ? `data:image/png;base64,${result.data[0].b64_json}` : null);

      if (imageUrl) {
        console.log(`    Success with ${model}`);
        return imageUrl;
      }
    } catch (error) {
      console.warn(`    Model ${model} error: ${error.message}`);
    }
  }

  throw new Error('All models failed');
}

/**
 * 保存到 Cloudflare D1
 */
async function saveToD1(name, role, personality, imageUrl) {
  if (!D1_API_TOKEN || !D1_DATABASE_ID || !D1_ACCOUNT_ID) {
    console.log('    [Skip D1] Missing D1 credentials, saving to local file instead');
    return false;
  }

  const sql = `INSERT OR REPLACE INTO avatars (name, role, personality, image_url) VALUES (?, ?, ?, ?)`;

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${D1_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sql: sql,
          params: [name, role, personality || 'steady', imageUrl]
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`D1 API error: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.errors?.[0]?.message || 'Unknown D1 error');
    }

    return true;
  } catch (error) {
    console.warn(`    D1 save error: ${error.message}`);
    return false;
  }
}

/**
 * 保存到本地 JSON 文件（备用）
 */
const fs = require('fs');
const path = require('path');

function saveToLocalFile(avatars) {
  const outputPath = path.join(__dirname, '..', 'public', 'avatars.json');
  fs.writeFileSync(outputPath, JSON.stringify(avatars, null, 2));
  console.log(`\nSaved ${avatars.length} avatars to ${outputPath}`);
}

/**
 * 主函数
 */
async function main() {
  console.log('=== Avatar Generation Script ===\n');

  if (!API_KEY) {
    console.error('Error: SILICONFLOW_API_KEY or VITE_API_KEY environment variable not set');
    process.exit(1);
  }

  // 解析命令行参数
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const roleFilter = args.find(a => a.startsWith('--role='))?.split('=')[1];
  const nameFilter = args.find(a => a.startsWith('--name='))?.split('=')[1];

  if (isDryRun) console.log('Mode: Dry Run (no saving)\n');
  if (roleFilter) console.log(`Filter: Role = ${roleFilter}\n`);
  if (nameFilter) console.log(`Filter: Name = ${nameFilter}\n`);

  const avatars = [];
  const filteredNames = nameFilter ? [nameFilter] : NAMES;
  const filteredRoles = roleFilter ? [roleFilter] : ROLES;

  let successCount = 0;
  let failCount = 0;

  for (const name of filteredNames) {
    console.log(`\n[${name}]`);

    for (const role of filteredRoles) {
      // 为每个角色生成一个默认性格的头像
      const personality = 'steady'; // 使用默认性格减少生成数量

      try {
        const imageUrl = await generateAvatar(name, role, personality);

        if (!isDryRun) {
          const saved = await saveToD1(name, role, personality, imageUrl);
          if (!saved) {
            // 本地备份
            avatars.push({ name, role, personality, image_url: imageUrl });
          }
        }

        successCount++;

        // 添加延迟避免 API 限流
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`    Failed: ${error.message}`);
        failCount++;
      }
    }
  }

  // 保存本地备份
  if (avatars.length > 0) {
    saveToLocalFile(avatars);
  }

  console.log('\n=== Summary ===');
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log('Done!');
}

main().catch(console.error);
