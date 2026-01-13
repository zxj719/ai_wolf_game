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
  seerChecks,
  AI_MODELS = [] // Default to empty array if not passed
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
              <div className="w-14 h-14 rounded-full mb-2 border-2 border-white/5 overflow-hidden relative shadow-2xl" style={{backgroundColor: p.avatarColor}}>
                  {p.avatarUrl ? (
                    <img 
                      src={p.avatarUrl} 
                      alt={p.name} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to colored circle with icon if image fails
                        e.target.style.display = 'none';
                        e.target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center text-white/20 font-black">${p.isUser ? '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M12 14c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z"/></svg>' : p.id}</div>`;
                      }}
                    />
                  ) : (
                    p.isUser ? <User size={24}/> : <span className="text-white/20 font-black">{p.id}</span>
                  )}
                  {!p.isAlive && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Skull size={24} className="text-rose-600" /></div>}
              </div>
              <span className="text-[11px] font-black">{p.name}</span>
              
              {/* 显示 AI 模型名称 (精简显示) */}
              {!p.isUser && AI_MODELS.length > 0 && (
                <div className="text-[6px] text-zinc-500 mt-0.5 truncate max-w-[80px]">
                  {AI_MODELS[p.id % AI_MODELS.length]?.id.split('/').pop()}
                </div>
              )}

              <div className="mt-1 flex flex-wrap gap-1 justify-center">
                {/* 1. 显示用户自己的身份 */}
                {p.isUser && (
                  <span className="text-[7px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-0.5">
                    {getRoleIcon(p.role)} {p.role}(你)
                  </span>
                )}

                {/* 2. 如果用户是狼人，显示其他狼人队友 */}
                {isTeammate && (
                  <span className="text-[7px] bg-rose-500 text-white px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-0.5">
                    {getRoleIcon('狼人')} 狼同伴
                  </span>
                )}
                
                {/* 3. 全AI模式或游戏结束显示所有身份 */}
                {((gameMode === 'ai-only') || (phase === 'game_over')) && !p.isUser && !isTeammate && p.role && (
                  <span className="text-[7px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                    {getRoleIcon(p.role)} {p.role}
                  </span>
                )}
                
                {/* 4. 仅显示已死亡状态 (如果上面已经显示了身份，则不必重复显示'已死亡'，但为了明确状态可以保留，或者用样式区分) */}
                {/* 简化：如果已经显示了身份，就不显示纯文本的"已死亡"，因为头像已经变灰了。但也可以保留。 */}
                {!p.isAlive && !((gameMode === 'ai-only') || (phase === 'game_over') || p.isUser || isTeammate) && (
                   <span className="text-[7px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded font-bold">已死亡</span>
                )}

                {/* 5. 如果用户是预言家，显示查验结果 */}
                {userPlayer?.role === '预言家' && seerChecks.some(c => c.targetId === p.id) && (
                  <span className={`text-[7px] text-white px-1.5 py-0.5 rounded font-black uppercase flex items-center gap-0.5 ${seerChecks.find(c => c.targetId === p.id).isWolf ? 'bg-rose-600' : 'bg-sky-600'}`}>
                    {seerChecks.find(c => c.targetId === p.id).isWolf ? '狼人' : '好人'}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
