/**
 * useTennisGame.js — 游戏状态机（纯 reducer，数值规则与原版 1:1）
 *
 * 所有随机数（对手属性、双方骰子）由调用方掷好后通过 action 注入，
 * reducer 保持纯函数，便于 vitest 验证盘分推进等关键路径。
 *
 * 原版规则备忘：
 * - 玩家临场骰 d20，对手 d12（主场观众加成）；平分时鹰眼判主队（玩家）得分
 * - 常规盘比拼单项属性，玩家额外吃 talent*0.4 加成
 * - 决胜盘比拼总战力：玩家 sta+skill+mind+talent vs 对手三维之和
 * - 每盘先得 2 球者拿下；先得 2 盘者获胜；1:1 时直接跳决胜盘（setIdx=2）
 */

import { useReducer } from 'react';
import { CHARS, PREP, SETS } from './gameData';

export function gradeFromMs(ms) {
  if (ms < 250) return { grade: 'S', talent: 90, quip: '这反应，职业球探已经在场边记笔记了！' };
  if (ms < 400) return { grade: 'A', talent: 70, quip: '眼疾手快，家庭赛场一霸。' };
  if (ms < 600) return { grade: 'B', talent: 50, quip: '中规中矩，胜负全看后面骚操作。' };
  return { grade: 'C', talent: 30, quip: '没事，网球是圆的，奇迹是会发生的。' };
}

export const initialState = {
  screen: 'select', // select | react | prep | match | result
  player: null,     // { name, face, talent, sta, skill, mind, ms, grade }
  opp: null,        // { name, face, sta, skill, mind }
  prepRound: 0,
  setIdx: 0,
  setsP: 0,
  setsO: 0,
  sceneIdx: 0,
  sceneP: 0,
  sceneO: 0,
  setHistory: [],
  lastRally: null,  // { pBase, pRoll, pTot, oBase, oRoll, oTot, win, label }
};

export function tennisReducer(state, action) {
  switch (action.type) {
    case 'START': {
      const me = CHARS.find((c) => c.n === action.playerName);
      const foe = CHARS.find((c) => c.n === action.oppName);
      return {
        ...initialState,
        screen: 'react',
        player: { name: me.n, face: me.f, talent: 0, sta: 0, skill: 0, mind: 0, ms: null, grade: '' },
        opp: { name: foe.n, face: foe.f, ...action.oppStats },
      };
    }

    case 'SET_REACTION': {
      const { grade, talent } = gradeFromMs(action.ms);
      return { ...state, player: { ...state.player, ms: action.ms, grade, talent } };
    }

    case 'TO_PREP':
      return { ...state, screen: 'prep', prepRound: 0 };

    case 'PICK_PREP': {
      const fx = PREP[state.prepRound].opts[action.optIdx].fx;
      const player = { ...state.player };
      for (const k in fx) {
        player[k] = Math.max(0, player[k] + fx[k]);
      }
      const prepRound = state.prepRound + 1;
      if (prepRound < PREP.length) {
        return { ...state, player, prepRound };
      }
      return {
        ...state, player, prepRound,
        screen: 'match',
        setIdx: 0, setsP: 0, setsO: 0,
        sceneIdx: 0, sceneP: 0, sceneO: 0,
        setHistory: [], lastRally: null,
      };
    }

    case 'PLAY_SCENE': {
      const set = SETS[state.setIdx];
      const p = state.player;
      const o = state.opp;
      let pBase, oBase, label;
      if (set.decider) {
        pBase = p.sta + p.skill + p.mind + p.talent;
        oBase = o.sta + o.skill + o.mind;
        label = '总战力';
      } else {
        const attr = set.scenes[state.sceneIdx].opts[action.optIdx].a;
        pBase = p[attr] + Math.round(p.talent * 0.4);
        oBase = o[attr];
        label = { sta: '体力', skill: '技巧', mind: '心态' }[attr];
      }
      const pTot = pBase + action.pRoll;
      const oTot = oBase + action.oRoll;
      const win = pTot >= oTot; // 平分时，鹰眼回放判定主队得分
      return {
        ...state,
        sceneP: state.sceneP + (win ? 1 : 0),
        sceneO: state.sceneO + (win ? 0 : 1),
        lastRally: { pBase, pRoll: action.pRoll, pTot, oBase, oRoll: action.oRoll, oTot, win, label },
      };
    }

    case 'NEXT_SCENE': {
      if (state.sceneP === 2 || state.sceneO === 2) {
        const pWon = state.sceneP === 2;
        const setsP = state.setsP + (pWon ? 1 : 0);
        const setsO = state.setsO + (pWon ? 0 : 1);
        const setHistory = [...state.setHistory, pWon ? 'W' : 'L'];
        if (setsP === 2 || setsO === 2) {
          return { ...state, setsP, setsO, setHistory, screen: 'result', lastRally: null };
        }
        const setIdx = setsP === 1 && setsO === 1 ? 2 : state.setIdx + 1;
        return {
          ...state, setsP, setsO, setHistory, setIdx,
          sceneIdx: 0, sceneP: 0, sceneO: 0, lastRally: null,
        };
      }
      return { ...state, sceneIdx: state.sceneIdx + 1, lastRally: null };
    }

    case 'REPLAY':
      return initialState;

    default:
      return state;
  }
}

export function useTennisGame() {
  return useReducer(tennisReducer, initialState);
}
