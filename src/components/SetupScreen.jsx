import React from 'react';
import { User, Brain } from 'lucide-react';

export const SetupScreen = ({ 
  gameMode, 
  setGameMode, 
  selectedSetup, 
  setSelectedSetup, 
  gameSetups 
}) => {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8">
      <h1 className="text-4xl font-black tracking-tighter">
        WEREWOLF <span className="text-indigo-500">PRO</span>
      </h1>

      {/* Setup Selection */}
      <div className="flex gap-4 p-2 bg-zinc-900/50 rounded-xl">
         {gameSetups.map(setup => (
           <button
             key={setup.id}
             onClick={() => setSelectedSetup(setup)}
             className={`px-6 py-3 rounded-lg font-bold transition-all ${
                selectedSetup.id === setup.id 
                ? 'bg-indigo-600 text-white shadow-lg' 
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
             }`}
           >
             <div className="text-lg">{setup.name}</div>
             <div className="text-xs opacity-70 font-normal">{setup.description}</div>
           </button>
         ))}
      </div>

      <h2 className="text-xl text-zinc-400">请选择开始模式</h2>
      <div className="flex gap-6">
        <button
          onClick={() => setGameMode('player')}
          className="group px-10 py-6 bg-gradient-to-br from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 rounded-2xl text-xl font-bold transition-all transform hover:scale-105 shadow-xl flex flex-col items-center gap-3"
        >
          <User className="w-10 h-10" />
          <span>玩家模式</span>
          <span className="text-sm text-green-200 font-normal">您将扮演一名玩家</span>
        </button>
        <button
          onClick={() => setGameMode('ai-only')}
          className="group px-10 py-6 bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 rounded-2xl text-xl font-bold transition-all transform hover:scale-105 shadow-xl flex flex-col items-center gap-3"
        >
          <Brain className="w-10 h-10" />
          <span>全AI模式</span>
          <span className="text-sm text-purple-200 font-normal">观看{selectedSetup.TOTAL_PLAYERS}位AI对战</span>
        </button>
      </div>
    </div>
  );
};
