import { ArrowUpRight, ChevronLeft, Globe, LineChart, Music4 } from 'lucide-react';
import { useState } from 'react';
import { ChordsPage } from './ChordsPage';
import { StockPage } from './Stock/StockPage';

function getCopy(locale) {
  if (locale === 'en') {
    return {
      title: 'Projects & Labs',
      subtitle: 'A minimal directory for public pages and tools.',
      description: 'Keep public links in one calm place. Project pages and internal tools are separated, but they no longer need different visual systems.',
      back: 'Back',
      items: [
        {
          key: 'site',
          title: 'Static site',
          description: 'Articles, projects, and long-form profile content.',
          cta: 'Open site',
        },
        {
          key: 'chords',
          title: 'Music arrangement lab',
          description: 'Upload an MP3 and turn browser audio cues into a MiniMax arrangement report.',
          cta: 'Open lab',
        },
        {
          key: 'stock',
          title: 'Market tool',
          description: 'Realtime market data and watchlist utilities.',
          cta: 'Open tool',
        },
      ],
    };
  }

  return {
    title: 'Projects & Labs',
    subtitle: '把公开页面和实验工具放进一个统一入口。',
    description: '项目页和工具页继续分开，但视觉语言保持一致，不再各自长成不同的站。',
    back: '返回',
    items: [
      {
        key: 'site',
        title: '静态站',
        description: '文章、项目和长期介绍内容。',
        cta: '打开站点',
      },
      {
        key: 'chords',
        title: 'Music arrangement lab',
        description: '上传 MP3，结合浏览器音频摘要和 MiniMax 输出编曲解读。',
        cta: '打开实验室',
      },
      {
        key: 'stock',
        title: '行情工具',
        description: '实时行情与自选股工具。',
        cta: '打开工具',
      },
    ],
  };
}

export function SitesPage({ onBack, locale = 'zh' }) {
  const [view, setView] = useState('hub');
  const copy = getCopy(locale);

  if (view === 'stock') {
    return <StockPage onBack={() => setView('hub')} />;
  }

  if (view === 'chords') {
    return <ChordsPage onBack={() => setView('hub')} locale={locale} />;
  }

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mac-window overflow-hidden">
          <div className="mac-toolbar">
            <div className="flex items-center gap-4">
              <div className="mac-window-chrome">
                <span className="mac-window-dot mac-dot-red" />
                <span className="mac-window-dot mac-dot-yellow" />
                <span className="mac-window-dot mac-dot-green" />
              </div>
              <div>
                <div className="mac-eyebrow">Zhaxiaoji Studio</div>
                <h1 className="text-base font-semibold text-slate-900">{copy.title}</h1>
              </div>
            </div>

            <button type="button" onClick={onBack} className="mac-button mac-button-secondary">
              <ChevronLeft size={15} />
              {copy.back}
            </button>
          </div>

          <main className="grid gap-8 px-6 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
            <section className="space-y-4">
              <div className="mac-eyebrow">{copy.subtitle}</div>
              <h2 className="text-[clamp(2.25rem,5vw,3.5rem)] font-semibold tracking-tight text-slate-950">
                {copy.title}
              </h2>
              <p className="max-w-2xl text-base leading-7 text-slate-500">{copy.description}</p>
            </section>

            <section className="space-y-3">
              <a
                href="/site/index.html"
                target="_blank"
                rel="noopener noreferrer"
                className="mac-list-row block transition-colors hover:bg-white/90"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="mac-icon-tile h-10 w-10 rounded-[16px]">
                      <Globe size={17} />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{copy.items[0].title}</div>
                      <div className="text-sm text-slate-500">{copy.items[0].description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    {copy.items[0].cta}
                    <ArrowUpRight size={15} />
                  </div>
                </div>
              </a>

              <button
                type="button"
                onClick={() => setView('chords')}
                className="mac-list-row w-full text-left transition-colors hover:bg-white/90"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="mac-icon-tile h-10 w-10 rounded-[16px]">
                      <Music4 size={17} />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{copy.items[1].title}</div>
                      <div className="text-sm text-slate-500">{copy.items[1].description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    {copy.items[1].cta}
                    <ArrowUpRight size={15} />
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setView('stock')}
                className="mac-list-row w-full text-left transition-colors hover:bg-white/90"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="mac-icon-tile h-10 w-10 rounded-[16px]">
                      <LineChart size={17} />
                    </span>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{copy.items[2].title}</div>
                      <div className="text-sm text-slate-500">{copy.items[2].description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    {copy.items[2].cta}
                    <ArrowUpRight size={15} />
                  </div>
                </div>
              </button>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
