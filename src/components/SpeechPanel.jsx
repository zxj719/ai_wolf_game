import React from 'react';
import { RefreshCw, Send } from 'lucide-react';

export function SpeechPanel({
  players,
  speakerIndex,
  speakingOrder,
  setSpeakingOrder,
  userInput,
  setUserInput,
  handleUserSpeak,
  isThinking,
  gameMode,
}) {
  const alive = players.filter(x => x.isAlive);
  const current = alive[speakerIndex];
  const isUserTurn = current?.isUser && gameMode !== 'ai-only';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-success animate-ping" />
          <span className="text-[10px] font-black text-ink-muted uppercase">Speaker: [{current?.id}号]</span>
        </div>
        <span className="text-[9px] px-3 py-1 rounded-lg font-bold bg-bg-sunken text-ink-muted">
          {speakingOrder === 'left' ? '↻ 顺时针' : '↺ 逆时针'}
        </span>
      </div>
      {isUserTurn ? (
        <div className="flex gap-4">
          <input
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="在此输入你的分析..."
            className="flex-1 bg-bg-sunken border border-line rounded-2xl px-6 py-4 text-sm text-ink placeholder-ink-faint outline-none"
            onKeyDown={(e) => e.key === 'Enter' && userInput.trim() && handleUserSpeak()}
          />
          <button onClick={handleUserSpeak} className="px-8 bg-accent text-white rounded-2xl hover:bg-accent-hover transition-all"><Send size={24}/></button>
        </div>
      ) : (
        <div className="py-8 flex flex-col items-center justify-center text-ink-faint">
           <RefreshCw className="animate-spin mb-2" size={24}/>
           <p className="text-[10px] font-bold">AI STRATEGIZING...</p>
        </div>
      )}
    </div>
  );
}
