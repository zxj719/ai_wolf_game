import { ArrowLeft } from 'lucide-react';

export function SitesPage({ onReturnHome, returnLabel = '返回首页' }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-sm">
        <span className="text-sm text-zinc-300">我的博客</span>
        {onReturnHome && (
          <button
            onClick={onReturnHome}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-zinc-700 transition-colors"
          >
            <ArrowLeft size={14} />
            {returnLabel}
          </button>
        )}
      </header>
      <iframe
        title="个人博客"
        src="/site/index.html"
        className="flex-1 w-full border-0 bg-zinc-950"
      />
    </div>
  );
}
