import { Globe, ExternalLink, ChevronLeft, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { StockPage } from './Stock/StockPage';

export function SitesPage({ onBack }) {
  const [view, setView] = useState('sites'); // 'sites' | 'stock'

  if (view === 'stock') {
    return <StockPage onBack={() => setView('sites')} />;
  }
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Globe size={18} className="text-white" />
            </div>
            <div>
              <span className="text-zinc-300 text-sm">站点入口</span>
              <span className="text-white font-medium ml-1">Sites</span>
            </div>
          </div>

          <button
            onClick={onBack}
            className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors flex items-center gap-1"
          >
            <ChevronLeft size={16} />
            返回主页
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">我的站点</h1>
          <p className="text-zinc-400">这里汇总你的内容入口与外部站点，后续可继续扩展。</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="group relative bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-2xl overflow-hidden hover:border-blue-600/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Globe size={28} className="text-white" />
                </div>
                <span className="px-3 py-1 bg-blue-600/20 border border-blue-600/50 text-blue-400 text-xs rounded-full">
                  内容更新中
                </span>
              </div>

              <h2 className="text-xl font-bold text-white mb-2">个人站点</h2>
              <p className="text-zinc-400 text-sm mb-4 leading-relaxed">
                工作与生活的记录与思考。欢迎浏览我的文章与项目摘要。
              </p>

              <a
                href="/site/index.html"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/30"
              >
                进入站点
                <ExternalLink size={16} />
              </a>
            </div>
          </div>

          <div className="group relative bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-2xl overflow-hidden hover:border-amber-600/50 transition-all duration-300 cursor-pointer" onClick={() => setView('stock')}>
            <div className="absolute inset-0 bg-gradient-to-br from-amber-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <TrendingUp size={28} className="text-white" />
                </div>
                <span className="px-3 py-1 bg-amber-600/20 border border-amber-600/50 text-amber-400 text-xs rounded-full">
                  实时数据
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">实时行情</h2>
              <p className="text-zinc-400 text-sm mb-4 leading-relaxed">
                美股、港股、A股、加密货币实时行情，WebSocket 推送，自定义自选列表。
              </p>
              <button className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-600/30">
                进入行情
                <TrendingUp size={16} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
