import React from 'react';
import { Moon, Sun, Brain } from 'lucide-react';

export const GameHeader = ({ phase, dayCount, isThinking, children }) => {
  return (
    <header className="max-w-6xl mx-auto w-full flex justify-between items-center mb-6 bg-bg-raised/60 p-5 rounded-[2rem] border border-white/5 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-2xl ${phase.includes('night') ? 'bg-state-selected-soft text-phase-night' : 'bg-role-hunter-soft text-phase-day'}`}>
          {phase.includes('night') ? <Moon size={28}/> : <Sun size={28}/>}
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tighter">WEREWOLF <span className="text-phase-night">PRO</span></h1>
          <div className="flex gap-2 mt-1">
             <span className="text-[10px] bg-bg-raised px-2 py-0.5 rounded text-ink-muted font-bold">DAY {dayCount}</span>
             <span className="text-[10px] text-ink-faint font-bold uppercase">{phase.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6">
         {isThinking && (
           <div className="flex items-center gap-2 px-4 py-2 bg-state-selected-soft border border-state-selected/20 rounded-xl animate-pulse">
             <Brain size={14} className="text-phase-night"/>
             <span className="text-[10px] text-phase-night font-black">AI REASONING</span>
           </div>
         )}
         <div className="text-right">
            {children}
         </div>
      </div>
    </header>
  );
};
