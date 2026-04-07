import {
  ArrowRight,
  ChevronLeft,
  ExternalLink,
  FlaskConical,
  Globe,
  Sparkles,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { useState } from 'react';
import { StockPage } from './Stock/StockPage';

const entryCards = [
  {
    key: 'project',
    label: 'Project',
    title: '静态个人站',
    description: '文章、作品、更新日志和个人信息的沉淀区。适合查看长期内容，也适合继续扩展新的项目页。',
    href: '/site/index.html',
    cta: '打开项目站',
    accent: 'from-cyan-500 to-sky-600',
    ring: 'border-cyan-500/30 hover:border-cyan-400/60',
    badge: 'Published',
    icon: Globe,
  },
  {
    key: 'market',
    label: 'Lab',
    title: '实时行情工具',
    description: '美股、港股、A股与加密资产的实时行情查看，保留在实验区里，方便快速切换和继续打磨。',
    cta: '进入实验',
    accent: 'from-amber-500 to-orange-600',
    ring: 'border-amber-500/30 hover:border-amber-400/60',
    badge: 'Live',
    icon: TrendingUp,
  },
];

export function SitesPage({ onBack }) {
  const [view, setView] = useState('hub'); // 'hub' | 'stock'

  if (view === 'stock') {
    return <StockPage onBack={() => setView('hub')} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-18rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-[-8rem] top-[12rem] h-[24rem] w-[24rem] rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">Zhaxiaoji Studio</div>
              <div className="text-sm font-medium text-zinc-200">Projects & Labs Hub</div>
            </div>
          </div>

          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
          >
            <ChevronLeft size={16} />
            返回主页
          </button>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <section className="mb-10 grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
            <div className="mb-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
                <Sparkles size={14} />
                Studio hub
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
                <Wrench size={14} />
                Projects
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
                <FlaskConical size={14} />
                Labs
              </span>
            </div>

            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              项目、实验与工具，集中在同一个工作台里。
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
              这里不再强调“站点入口”，而是把 Zhaxiaoji Studio 的长期项目、临时实验和实用工具放到同一层级，方便快速进入，也方便后续继续扩展。
            </p>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 backdrop-blur">
              <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">Scope</div>
              <div className="mt-2 text-lg font-medium text-white">Projects / Labs / Tools</div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                保留稳定入口，同时把实验性模块和工具化能力拆分清楚，避免页面语义停留在“站点列表”。
              </p>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-zinc-500">Brand</div>
              <div className="mt-2 text-lg font-medium text-white">Zhaxiaoji Studio</div>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                统一用这个品牌承载公开页、项目页和法务页，保持视觉和语气一致。
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          {entryCards.map((card) => {
            const Icon = card.icon;
            const isMarket = card.key === 'market';
            const content = (
              <div className={`group relative overflow-hidden rounded-3xl border bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 transition-all duration-300 ${card.ring}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative">
                  <div className="mb-5 flex items-start justify-between">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} shadow-lg shadow-black/30`}>
                      <Icon size={26} className="text-white" />
                    </div>
                    <span className="rounded-full border border-zinc-700 bg-zinc-950/80 px-3 py-1 text-xs text-zinc-300">
                      {card.badge}
                    </span>
                  </div>

                  <div className="text-xs uppercase tracking-[0.28em] text-zinc-500">{card.label}</div>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{card.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">{card.description}</p>

                  <div className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-800 px-4 py-3 font-medium text-white shadow-lg shadow-black/20 transition-transform group-hover:translate-y-[-1px] hover:bg-zinc-700">
                    {card.cta}
                    {isMarket ? <ArrowRight size={16} /> : <ExternalLink size={16} />}
                  </div>
                </div>
              </div>
            );

            if (isMarket) {
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => setView('stock')}
                  className="text-left"
                >
                  {content}
                </button>
              );
            }

            return (
              <a key={card.key} href={card.href} target="_blank" rel="noopener noreferrer" className="block">
                {content}
              </a>
            );
          })}
        </section>
      </main>
    </div>
  );
}
