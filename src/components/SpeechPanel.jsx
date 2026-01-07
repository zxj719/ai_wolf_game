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
}) {
  const alive = players.filter(x => x.isAlive);
  const current = alive[speakerIndex];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-[10px] font-black text-zinc-500 uppercase">Speaker: [{current?.id}号]</span>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setSpeakingOrder('left')}
            className={`text-[9px] px-3 py-1 rounded-lg font-bold ${speakingOrder === 'left' ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}
          >
            顺时针
          </button>
          <button 
            onClick={() => setSpeakingOrder('right')}
            className={`text-[9px] px-3 py-1 rounded-lg font-bold ${speakingOrder === 'right' ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}
          >
            逆时针
          </button>
        </div>
      </div>
      {current?.isUser ? (
        <div className="flex gap-4">
          <input 
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="在此输入你的分析..."
            className="flex-1 bg-zinc-800/80 border border-white/10 rounded-2xl px-6 py-4 text-sm outline-none"
            onKeyDown={(e) => e.key === 'Enter' && userInput.trim() && handleUserSpeak()}
          />
          <button onClick={handleUserSpeak} className="px-8 bg-indigo-600 rounded-2xl hover:bg-indigo-500 transition-all"><Send size={24}/></button>
        </div>
      ) : (
        <div className="py-8 flex flex-col items-center justify-center text-zinc-600">
           <RefreshCw className="animate-spin mb-2" size={24}/>
           <p className="text-[10px] font-bold">AI STRATEGIZING...</p>
        </div>
      )}
    </div>
  );
}
