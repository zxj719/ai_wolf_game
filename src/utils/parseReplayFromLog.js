/**
 * 解析导出的 .txt 游戏记录 → 回放 timeline JSON。
 *
 * 输入：exportGameLog 产生的 .txt 文件全文。
 * 输出：与 buildReplayTimeline 相同格式的 { meta, players, timeline }。
 *
 * txt 格式用中文 section header【…】分隔，本解析器逐段提取。
 */
import { buildReplayTimeline } from './buildReplayTimeline';

function splitSections(text) {
  const sections = {};
  let currentKey = null;
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.match(/^【(.+?)】/);
    if (match) {
      currentKey = match[1];
      sections[currentKey] = [];
    } else if (currentKey) {
      sections[currentKey].push(line);
    }
  }
  return sections;
}

function parsePlayers(lines) {
  const players = [];
  for (const line of lines) {
    const m = line.match(/^(\d+)号\s+(.+?)(?:\s+\(你\))?:\s+(\S+)\s+\[(\S+)\]/);
    if (m) {
      players.push({
        id: parseInt(m[1]),
        name: m[2].trim(),
        role: m[3],
        finalStatus: m[4] === '存活' ? 'alive' : 'dead',
        isUser: line.includes('(你)'),
      });
    }
  }
  return players;
}

function parseDeathHistory(lines) {
  const deaths = [];
  for (const line of lines) {
    const m = line.match(/^第(\d+)天(\S+?):\s+(\d+)号/);
    if (m) {
      deaths.push({
        day: parseInt(m[1]),
        phase: m[2],
        playerId: parseInt(m[3]),
        cause: line.split(' - ')[1]?.trim() || '',
      });
    }
  }
  return deaths;
}

function parseSpeeches(lines) {
  const speeches = [];
  let currentDay = 0;
  let current = null;

  const flush = () => { if (current) speeches.push(current); };

  for (const line of lines) {
    const dayMatch = line.match(/^---\s*第(\d+)天\s*---/);
    if (dayMatch) {
      flush();
      current = null;
      currentDay = parseInt(dayMatch[1]);
      continue;
    }

    const speechMatch = line.match(/^\[(\d+)号\s+(.+?)\s+\((.+?)\)\]:\s*(.*)/);
    if (speechMatch) {
      flush();
      current = {
        day: currentDay,
        playerId: parseInt(speechMatch[1]),
        name: speechMatch[2],
        content: speechMatch[4],
        thought: null,
        voteIntention: null,
      };
      continue;
    }

    if (current) {
      const thoughtMatch = line.match(/^\s+💭\s*思考过程:\s*(.*)/);
      if (thoughtMatch) { current.thought = thoughtMatch[1]; continue; }

      const voteMatch = line.match(/^\s+🗳️\s*投票意向:\s*(.*)/);
      if (voteMatch) {
        const raw = voteMatch[1].trim();
        current.voteIntention = raw === '弃票' ? -1 : parseInt(raw);
        continue;
      }
    }
  }
  flush();
  return speeches;
}

function parseVotes(lines) {
  const rounds = [];
  let current = null;

  for (const line of lines) {
    const dayMatch = line.match(/^第(\d+)天投票/);
    if (dayMatch) {
      if (current) rounds.push(current);
      current = { day: parseInt(dayMatch[1]), votes: [], eliminated: null };
      continue;
    }

    if (!current) continue;

    const voteMatch = line.match(/^\s+(\d+)号\(.+?\)\s*->\s*(弃票|\d+号)/);
    if (voteMatch) {
      current.votes.push({
        from: parseInt(voteMatch[1]),
        to: voteMatch[2] === '弃票' ? -1 : parseInt(voteMatch[2]),
      });
      continue;
    }

    const resultMatch = line.match(/^\s*结果:\s*(\d+)号/);
    if (resultMatch) {
      current.eliminated = parseInt(resultMatch[1]);
    } else if (/^\s*结果:\s*无人/.test(line)) {
      current.eliminated = null;
    }
  }
  if (current) rounds.push(current);
  return rounds;
}

function parseNightActions(lines) {
  const actions = [];
  let currentNight = 0;

  for (const line of lines) {
    const phaseMatch = line.match(/^---\s*第(\d+)(夜|天)\s*---/);
    if (phaseMatch) {
      currentNight = parseInt(phaseMatch[1]);
      continue;
    }

    const actionMatch = line.match(/\[(\d+)号\s+(.+?)\s+\((.+?)\)\]\s+(\S+)/);
    if (actionMatch) {
      const targetMatch = line.match(/目标\s+(\d+)号/);
      const resultMatch = line.match(/结果：(\S+)/);
      const thoughtLine = lines[lines.indexOf(line) + 1];
      actions.push({
        night: currentNight,
        playerId: parseInt(actionMatch[1]),
        type: actionMatch[4],
        target: targetMatch ? parseInt(targetMatch[1]) : null,
        result: resultMatch ? resultMatch[1] : null,
        thought: thoughtLine?.match(/💭\s*思考过程:\s*(.*)/)?.[1] || null,
      });
    }
  }
  return actions;
}

function parseGameResult(text) {
  if (text.includes('好人阵营胜利')) return 'good_win';
  if (text.includes('狼人阵营胜利')) return 'wolf_win';
  return null;
}

function parseVictoryMode(text) {
  if (text.includes('屠边模式')) return 'edge';
  if (text.includes('屠城模式')) return 'city';
  return 'edge';
}

/**
 * @param {string} logText — full txt content from exportGameLog
 * @returns {{ meta, players, timeline }}
 */
export function parseReplayFromLog(logText) {
  const sections = splitSections(logText);
  const players = parsePlayers(sections['玩家身份'] || []);
  const deathHistory = parseDeathHistory(sections['死亡记录'] || []);
  const speeches = parseSpeeches(sections['发言记录'] || []);
  const votes = parseVotes(sections['投票记录'] || []);
  const nightActions = parseNightActions(sections['AI 决策思考过程'] || []);
  const gameResult = parseGameResult(logText);
  const victoryMode = parseVictoryMode(logText);

  const dayCountMatch = logText.match(/游戏天数:\s*(\d+)/);
  const dayCount = dayCountMatch ? parseInt(dayCountMatch[1]) : 1;

  return buildReplayTimeline({
    players: players.map((p) => ({ ...p, isAlive: p.finalStatus === 'alive' })),
    dayCount,
    deathHistory,
    speechHistory: speeches,
    voteHistory: votes,
    nightActionHistory: nightActions,
    gameResult,
    victoryMode,
  });
}
