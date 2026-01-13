// 发言压缩/精炼服务
// 使用轻量级模型对历史发言进行智能压缩，保留关键信息
// 替代简单的字符串截断

import { INSTRUCT_MODELS } from '../config/aiConfig';

// 本地缓存，避免重复压缩相同内容
const summaryCache = new Map();

/**
 * 生成缓存键
 */
const getCacheKey = (playerId, day, content) => {
  return `${playerId}-${day}-${content.slice(0, 20)}`;
};

/**
 * 使用AI压缩单条发言
 * @param {Object} params - 压缩参数
 * @param {string} params.content - 原始发言内容
 * @param {number} params.playerId - 发言玩家ID
 * @param {number} params.day - 发言所在天数
 * @param {string} params.role - 发言玩家角色（可选，用于提取角色相关信息）
 * @param {number} params.maxLength - 最大压缩长度，默认40字
 * @param {Object} aiConfig - AI配置 { API_URL, API_KEY }
 * @returns {Promise<string>} 压缩后的摘要
 */
export const summarizeSpeech = async ({ content, playerId, day, role, maxLength = 40 }, aiConfig) => {
  // 内容太短不需要压缩
  if (!content || content.length <= maxLength) {
    return content;
  }

  // 检查缓存
  const cacheKey = getCacheKey(playerId, day, content);
  if (summaryCache.has(cacheKey)) {
    return summaryCache.get(cacheKey);
  }

  // 构建压缩提示词
  const prompt = buildSummarizePrompt(content, role, maxLength);

  try {
    // 使用Instruct模型进行压缩（更快、更便宜）
    const model = INSTRUCT_MODELS[0] || { id: 'Qwen/Qwen2.5-32B-Instruct', options: {} };

    const response = await fetch(aiConfig.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiConfig.API_KEY}`
      },
      body: JSON.stringify({
        model: model.id,
        messages: [
          { role: 'system', content: '你是一个发言摘要专家。请精准提取狼人杀游戏发言中的关键信息。' },
          { role: 'user', content: prompt }
        ],
        ...model.options,
        max_tokens: 100
      })
    });

    if (!response.ok) {
      console.warn('[SpeechSummarizer] API请求失败，使用截断回退');
      return fallbackTruncate(content, maxLength);
    }

    const result = await response.json();
    const resultContent = result.choices?.[0]?.message?.content;

    // 尝试解析JSON响应
    let summary = extractSummary(resultContent, content, maxLength);

    // 缓存结果
    summaryCache.set(cacheKey, summary);
    return summary;

  } catch (error) {
    console.warn('[SpeechSummarizer] 压缩失败，使用截断回退:', error.message);
    return fallbackTruncate(content, maxLength);
  }
};

/**
 * 批量压缩多条发言
 * @param {Array} speeches - 发言列表 [{ content, playerId, day, role }, ...]
 * @param {Object} aiConfig - AI配置
 * @param {number} maxLength - 单条最大长度
 * @returns {Promise<Array>} 带摘要的发言列表
 */
export const summarizeSpeeches = async (speeches, aiConfig, maxLength = 40) => {
  // 并发限制，避免API过载
  const BATCH_SIZE = 5;
  const results = [];

  for (let i = 0; i < speeches.length; i += BATCH_SIZE) {
    const batch = speeches.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (speech) => {
        // 如果已有摘要，直接使用
        if (speech.summary && speech.summary.length <= maxLength) {
          return { ...speech, summary: speech.summary };
        }

        const summary = await summarizeSpeech({
          content: speech.content,
          playerId: speech.playerId,
          day: speech.day,
          role: speech.role,
          maxLength
        }, aiConfig);

        return { ...speech, summary };
      })
    );
    results.push(...batchResults);
  }

  return results;
};

/**
 * 根据角色构建不同的压缩提示词
 */
const buildSummarizePrompt = (content, role, maxLength) => {
  const roleHint = getRoleExtractionHint(role);

  return `请将以下狼人杀游戏发言精炼为不超过${maxLength}字的摘要。

【原始发言】
"${content}"

【提取重点】
${roleHint}
- 保留：身份声明、查验结果、投票意向、关键怀疑/站边
- 删除：情绪词、重复内容、无信息量的客套话
- 格式：直接输出核心信息，无需引号

输出JSON: {"summary": "摘要内容"}`;
};

/**
 * 根据角色获取提取提示
 */
const getRoleExtractionHint = (role) => {
  switch (role) {
    case '预言家':
      return '- 重点提取：查验目标、查验结果（金水/查杀）、警徽流安排';
    case '女巫':
      return '- 重点提取：用药信息（救/毒了谁）、银水声明';
    case '狼人':
      return '- 重点提取：伪装的身份、发的假金水/查杀、站边倾向';
    case '猎人':
      return '- 重点提取：身份声明、开枪意向';
    case '守卫':
      return '- 重点提取：守护信息（如果公开）';
    case '村民':
    default:
      return '- 重点提取：站边倾向、怀疑目标、投票意向';
  }
};

/**
 * 从AI响应中提取摘要
 */
const extractSummary = (resultContent, originalContent, maxLength) => {
  if (!resultContent) {
    return fallbackTruncate(originalContent, maxLength);
  }

  try {
    // 尝试解析JSON
    const jsonMatch = resultContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.summary) {
        return parsed.summary.slice(0, maxLength);
      }
    }
  } catch (e) {
    // JSON解析失败，尝试直接使用文本
  }

  // 如果不是JSON，直接使用文本内容（去除引号）
  const cleaned = resultContent.replace(/^["']|["']$/g, '').trim();
  return cleaned.slice(0, maxLength);
};

/**
 * 回退方案：智能截断
 * 优先保留关键词和完整句子
 */
const fallbackTruncate = (content, maxLength) => {
  if (content.length <= maxLength) return content;

  // 关键词列表（狼人杀术语）
  const keywords = ['金水', '查杀', '狼人', '预言家', '女巫', '猎人', '守卫', '投', '怀疑', '站边', '悍跳'];

  // 尝试找到包含关键词的句子
  const sentences = content.split(/[。！？；]/);
  let result = '';

  for (const sentence of sentences) {
    if (result.length >= maxLength) break;

    // 优先选择包含关键词的句子
    const hasKeyword = keywords.some(kw => sentence.includes(kw));
    if (hasKeyword || result.length === 0) {
      const toAdd = sentence.trim();
      if (result.length + toAdd.length <= maxLength) {
        result += (result ? '；' : '') + toAdd;
      }
    }
  }

  // 如果结果太短，补充内容
  if (result.length < maxLength / 2) {
    result = content.slice(0, maxLength - 3) + '...';
  }

  return result;
};

/**
 * 为特定视角压缩发言历史
 * 根据当前玩家的角色，提取对该角色最重要的信息
 * @param {Array} speeches - 发言列表
 * @param {Object} currentPlayer - 当前玩家 { id, role }
 * @param {Object} aiConfig - AI配置
 * @returns {Promise<string>} 格式化的历史摘要
 */
export const summarizeHistoryForRole = async (speeches, currentPlayer, aiConfig) => {
  if (!speeches || speeches.length === 0) {
    return '暂无历史发言';
  }

  // 根据角色确定关注重点
  const focusPoints = getRoleFocusPoints(currentPlayer.role);

  // 按天分组
  const byDay = {};
  for (const speech of speeches) {
    if (!byDay[speech.day]) byDay[speech.day] = [];
    byDay[speech.day].push(speech);
  }

  const summaryParts = [];

  for (const [day, daySpeechs] of Object.entries(byDay)) {
    // 压缩每天的发言
    const summarized = await summarizeSpeeches(daySpeechs, aiConfig, 35);

    // 按重要性排序（包含关键词的优先）
    const sorted = summarized.sort((a, b) => {
      const aScore = calculateRelevanceScore(a, focusPoints);
      const bScore = calculateRelevanceScore(b, focusPoints);
      return bScore - aScore;
    });

    // 取前5条最重要的
    const topSummaries = sorted.slice(0, 5);
    const dayContent = topSummaries
      .map(s => `${s.playerId}号:${s.summary || s.content.slice(0, 35)}`)
      .join('|');

    summaryParts.push(`D${day}:${dayContent}`);
  }

  return summaryParts.join('\n');
};

/**
 * 根据角色获取关注重点
 */
const getRoleFocusPoints = (role) => {
  switch (role) {
    case '狼人':
      return ['预言家', '金水', '查杀', '守卫', '女巫', '猎人', '怀疑我'];
    case '预言家':
      return ['悍跳', '对跳', '金水', '查杀', '站边', '质疑'];
    case '女巫':
      return ['被刀', '救', '毒', '预言家', '金水'];
    case '守卫':
      return ['预言家', '刀', '守护', '神职'];
    case '猎人':
      return ['查杀', '狼人', '悍跳', '开枪'];
    case '村民':
    default:
      return ['预言家', '金水', '查杀', '狼人', '投票'];
  }
};

/**
 * 计算发言与关注点的相关性得分
 */
const calculateRelevanceScore = (speech, focusPoints) => {
  const content = (speech.summary || speech.content || '').toLowerCase();
  let score = 0;

  for (const point of focusPoints) {
    if (content.includes(point.toLowerCase())) {
      score += 10;
    }
  }

  // 包含数字（可能是玩家号码）加分
  if (/\d+号/.test(content)) {
    score += 5;
  }

  return score;
};

/**
 * 清空缓存（在新游戏开始时调用）
 */
export const clearSummaryCache = () => {
  summaryCache.clear();
};
