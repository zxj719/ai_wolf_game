import React from 'react';
import { ArrowUp } from 'lucide-react';

export function GameLog({ logs }) {
  return (
    <div className="lg:col-span-5 flex flex-col bg-bg-raised rounded-[3rem] border border-line overflow-hidden shadow-2xl backdrop-blur-md">
      <div className="p-6 border-b border-line bg-bg-sunken">
        <span className="text-[10px] font-black text-ink-muted uppercase tracking-widest flex items-center gap-2"><ArrowUp size={14} className="text-accent"/> Activity Log</span>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {logs.map(log => (
          <div key={log.id} className="animate-in slide-in-from-top-2 duration-300">
            {log.type === 'chat' ? (
              <div className="flex flex-col items-start gap-1">
                <span className="text-[9px] font-black text-ink-faint ml-2 uppercase">{log.speaker}</span>
                <div className={`px-5 py-3 rounded-[1.5rem] rounded-tl-none text-[13px] border shadow-sm ${log.speaker === '你' ? 'bg-accent-soft text-ink border-line' : 'bg-bg-sunken text-ink border-line'}`}>
                  {log.text}
                </div>
              </div>
            ) : log.type === 'thought' ? (
              <div className="px-5 py-2 rounded-xl text-[11px] italic border bg-bg-sunken text-state-thinking border-line leading-relaxed">
                {log.text}
              </div>
            ) : (
              <div className={`px-5 py-2 rounded-xl text-[10px] font-black text-center border border-line uppercase ${
                log.type === 'danger' ? 'bg-danger-soft text-danger' :
                log.type === 'warning' ? 'bg-warning-soft text-warning' :
                log.type === 'success' ? 'bg-success-soft text-success' :
                'bg-accent-soft text-accent'
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
