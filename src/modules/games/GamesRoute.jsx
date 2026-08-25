import { ArrowUpRight, ChevronLeft, Puzzle } from 'lucide-react';
import { useShell } from '../../shell/ShellContext';
import { ROUTES } from '../../shell/paths';
import { GAMES } from './gamesList';

function localized(field, locale) {
  if (!field) return undefined;
  if (typeof field === 'string') return field;
  return field[locale] ?? field.zh ?? field.en;
}

function getCopy(locale) {
  if (locale === 'en') {
    return {
      title: 'Mini Games',
      subtitle: 'Lightweight tools and visual toys',
      description: 'A small arcade of client-side toys — no login, no queue, just open and play.',
      back: 'Back',
      cta: 'Open',
    };
  }
  return {
    title: '小游戏',
    subtitle: '轻量小工具与可视化玩具',
    description: '纯前端运行的小玩具合集，不占资源队列，随时打开随时玩。',
    back: '返回',
    cta: '打开',
  };
}

export default function GamesRoute() {
  const { locale = 'zh', navigate } = useShell();
  const copy = getCopy(locale);

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
                <h1 className="text-base font-semibold text-ink">{copy.title}</h1>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(ROUTES.HOME)}
              className="mac-button mac-button-secondary"
            >
              <ChevronLeft size={15} />
              {copy.back}
            </button>
          </div>

          <main className="grid gap-8 px-6 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
            <section className="space-y-4">
              <div className="mac-eyebrow">{copy.subtitle}</div>
              <h2 className="text-[clamp(2.25rem,5vw,3.5rem)] font-semibold tracking-tight text-ink">
                {copy.title}
              </h2>
              <p className="max-w-2xl text-base leading-7 text-ink-muted">{copy.description}</p>
            </section>

            <section className="space-y-3">
              {GAMES.map((game) => (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => navigate(game.path)}
                  className="mac-list-row w-full text-left transition-colors hover:bg-bg-sunken"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="mac-icon-tile h-10 w-10 rounded-[16px]">
                        <Puzzle size={17} />
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-ink">{localized(game.title, locale)}</div>
                        <div className="text-sm text-ink-muted">{localized(game.blurb, locale)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-ink-muted">
                      {copy.cta}
                      <ArrowUpRight size={15} />
                    </div>
                  </div>
                </button>
              ))}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
