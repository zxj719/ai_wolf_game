import React from 'react';
import { RefreshCw } from 'lucide-react';

export function VotePanel({ players, selectedTarget, isThinking, handleVote }) {
  const isUserAlive = players.find(p => p.id === 0)?.isAlive;
  return (
    <div className="text-center">
      <h2 className="text-lg font-black mb-2 uppercase tracking-widest text-phase-vote">Exile Vote</h2>
      {isUserAlive ? (
        <>
          <p className="text-[10px] text-ink-faint mb-6 font-medium">请基于逻辑投出你的放逐票</p>
          <button
            disabled={selectedTarget === null || isThinking}
            onClick={handleVote}
            className="px-14 py-4 bg-accent disabled:bg-bg-raised text-black rounded-2xl font-black text-xs uppercase hover:bg-accent-hover transition-all shadow-xl"
          >
            Cast Vote
          </button>
        </>
      ) : (
        <div className="py-8 flex flex-col items-center justify-center text-ink-faint">
          <RefreshCw className="animate-spin mb-2" size={24}/>
          <p className="text-[10px] font-bold">你已死亡，AI正在投票...</p>
        </div>
      )}
    </div>
  );
}
