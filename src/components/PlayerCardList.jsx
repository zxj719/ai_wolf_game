import React from 'react';
import { Skull, Eye, Shield, FlaskConical, Target, User } from 'lucide-react';

export function PlayerCardList({
  players,
  userPlayer,
  nightDecisions,
  selectedTarget,
  setSelectedTarget,
  speakerIndex,
  phase,
  gameMode,
}) {
  const getRoleIcon = (role) => {
    switch(role) {
      case '狼人': return <Skull size={12} className="text-rose-500"/>;
      case '预言家': return <Eye size={12} className="text-purple-500"/>;
      case '女巫': return <FlaskConical size={12} className="text-emerald-500"/>;
      case '猎人': return <Target size={12} className="text-orange-500"/>;
      case '守卫': return <Shield size={12} className="text-blue-500"/>;
      default: return <User size={12} className="text-zinc-500"/>;
    }
  };

  const aliveList = players.filter(x => x.isAlive);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {players.map(p => {
        const isTeammate = userPlayer?.role === '狼人' && p.role === '狼人' && p.id !== userPlayer.id;
        const isSpeaking = (aliveList[speakerIndex])?.id === p.id;

        return (
          <div 
            key={p.id} 
            onClick={() => p.isAlive && setSelectedTarget(p.id)}
            className={`relative p-4 rounded-[2rem] border-2 transition-all cursor-pointer ${selectedTarget === p.id ? 'border-indigo-500 bg-indigo-500/5 ring-4 ring-indigo-500/10' : 'bg-zinc-900 border-zinc-800'} ${!p.isAlive ? 'opacity-20 grayscale' : 'hover:border-zinc-700'} ${isSpeaking ? 'ring-2 ring-emerald-500' : ''}`}
          >
            <div className="flex flex-col items-center">
              <span className="absolute top-3 left-3 text-[10px] font-black text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{p.id}</span>
              <div className="w-14 h-14 rounded-full mb-2 border-2 border-white/5 flex items-center justify-center relative shadow-2xl" style={{backgroundColor: p.avatarColor}}>
                  {p.isUser ? <User size={24}/> : <span className="text-white/20 font-black">{p.id}</span>}
                  {!p.isAlive && <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center"><Skull size={24} className="text-rose-600" /></div>}
              </div>
              <span className="text-[11px] font-black">{p.name}</span>
              <div className="mt-1 flex flex-wrap gap-1 justify-center">
                {isTeammate && <span className="text-[7px] bg-rose-500 text-white px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-0.5">{getRoleIcon('狼人')} 狼友</span>}
                {p.isUser && <span className="text-[7px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-black uppercase">You</span>}
                {userPlayer?.role === '狼人' && p.role === '狼人' && p.id !== userPlayer.id && p.isAlive && (
                  <span className="text-[7px] bg-rose-500 text-white px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-0.5">{getRoleIcon('狼人')} 狼人</span>
                )}
                {gameMode === 'ai-only' && p.role && (
                  <span className="text-[7px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                    {getRoleIcon(p.role)} {p.role}
                  </span>
                )}
                {gameMode !== 'ai-only' && phase === 'game_over' && !p.isAlive && p.role && !p.isUser && !isTeammate && (
                  <span className="text-[7px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                    {getRoleIcon(p.role)} {p.role}
                  </span>
                )}
                {gameMode !== 'ai-only' && !p.isAlive && phase !== 'game_over' && !p.isUser && !isTeammate && (
                  <span className="text-[7px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded font-bold">已死亡</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
