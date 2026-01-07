import React from 'react';
import { ArrowUp } from 'lucide-react';

export function GameLog({ logs }) {
  return (
    <div className="lg:col-span-5 flex flex-col bg-zinc-900/40 rounded-[3rem] border border-white/5 overflow-hidden shadow-2xl backdrop-blur-md">
      <div className="p-6 border-b border-white/5 bg-zinc-800/40">
        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2"><ArrowUp size={14} className="text-indigo-500"/> Activity Log</span>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {logs.map(log => (
          <div key={log.id} className="animate-in slide-in-from-top-2 duration-300">
            {log.type === 'chat' ? (
              <div className="flex flex-col items-start gap-1">
                <span className="text-[9px] font-black text-zinc-600 ml-2 uppercase">{log.speaker}</span>
                <div className={`px-5 py-3 rounded-[1.5rem] rounded-tl-none text-[13px] border shadow-sm ${log.speaker === '你' ? 'bg-indigo-500/10 text-indigo-100 border-indigo-500/20' : 'bg-zinc-800/80 text-zinc-300 border-white/5'}`}>
                  {log.text}
                </div>
              </div>
            ) : (
              <div className={`px-5 py-2 rounded-xl text-[10px] font-black text-center border uppercase ${
                log.type === 'danger' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 
                log.type === 'warning' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                log.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
              }`}>
                {log.text}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
