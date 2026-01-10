import { useCallback } from 'react';
import { fetchLLM } from '../services/aiClient';
import { generateSystemPrompt, generateUserPrompt } from '../services/aiPrompts';

export function useAI({
  players,
  speechHistory,
  voteHistory,
  deathHistory,
  nightDecisions,
  seerChecks,
  guardHistory,
  witchHistory,
  dayCount,
  phase,
  setIsThinking,
  disabledModelsRef,
  API_URL,
  API_KEY,
  AI_MODELS
}) {


  const askAI = useCallback(async (player, actionType, params = {}) => {
    setIsThinking(true);
    
    // Construct GameState object
    const gameState = {
        players,
        speechHistory,
        voteHistory,
        deathHistory,
        nightDecisions,
        seerChecks,
        guardHistory,
        witchHistory,
        dayCount,
        phase
    };

    const systemPrompt = generateSystemPrompt(player, gameState);
    const userPrompt = generateUserPrompt(actionType, gameState, params);
    
    console.log(`[AI请求] ${player.id}号(${player.role}) Action:${actionType}`, userPrompt);

    const result = await fetchLLM(
      { player, prompt: userPrompt, systemInstruction: systemPrompt },
      { API_URL, API_KEY, AI_MODELS, disabledModelsRef }
    );
    setIsThinking(false);
    return result;
  }, [players, speechHistory, voteHistory, deathHistory, nightDecisions, seerChecks, guardHistory, witchHistory, dayCount, phase, API_KEY, AI_MODELS, API_URL, setIsThinking, disabledModelsRef]);

  return { askAI };
}
