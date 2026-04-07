import { useMemo, useState } from 'react';
import {
  Compass,
  FlaskConical,
  Globe2,
  KeyRound,
  LogIn,
  LogOut,
  Radar,
  Swords,
  Ticket,
  Trophy,
  UserCircle2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TokenManager } from './TokenManager';
import { UserStats } from './UserStats';
import { BalancedHeadline } from './home/BalancedHeadline';
import { HomePortalCard } from './home/HomePortalCard';
import { IdeaMasonry } from './home/IdeaMasonry';

export function Dashboard({
  onEnterWolfgame,
  onEnterSites,
  onLogout,
  isGuestMode = false,
  onLogin,
  onGuestPlay,
}) {
  const { user, tokenStatus, verifyModelscopeToken } = useAuth();
  const [showTokenManager, setShowTokenManager] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const isLoggedIn = !!user;
  const currentLabel = isGuestMode
    ? 'Guest mode is active'
    : isLoggedIn
      ? `Signed in as ${user?.username}`
      : 'Public homepage';

  const noteItems = useMemo(() => ([
    {
      category: 'Current focus',
      title: '把狼人杀保留下来，但不再让它定义整个站点。',
      description: '这次重构只动外层壳层。游戏逻辑、配置页和对局页继续沿用，重点是把项目入口、实验入口和个人表达重新排到同一张桌面上。',
      meta: 'Keep the engine, rebuild the shell',
    },
    {
      category: 'Pretext',
      title: '标题与信息卡不靠猜高度，直接提前测量。',
      description: '主页 headline 和文本驱动卡片都用 pretext 预估换行与高度，让版面在不同宽度下更稳定，也更像编辑式排版而不是一排平均卡片。',
      meta: 'Pretext + editorial layout',
    },
    {
      category: 'Open routes',
      title: '首页和项目 hub 公开访问，登录只负责增量能力。',
      description: '公开主页负责介绍项目和入口；登录后继续保存战绩、管理令牌、查看自己的狼人杀记录。这样首页终于像主页，而不是门禁。',
      meta: 'Public home, private gameplay state',
    },
    {
      category: 'Playable',
      title: '游客可以直接试玩 AI 狼人杀。',
      description: '没有账号也能进入试玩，登录用户再解锁令牌配置与战绩沉淀。这样主页既能展示内容，也能立刻让人开始玩。',
      meta: 'Guest-ready werewolf entry',
    },
    {
      category: 'Elsewhere',
      title: '实验站和实时行情不再躲在“站点入口”后面。',
      description: '它们现在被归类成 Projects & Labs，语义更清楚，也更适合继续加新的实验或工具模块。',
      meta: 'Projects, labs, and tools',
      link: '/site/index.html',
    },
  ]), []);

  const wolfgamePrimaryAction = { label: '进入狼人杀模块', onClick: onEnterWolfgame };

  const wolfgameSecondaryAction = isLoggedIn
    ? { label: '查看我的战绩', onClick: () => setShowStats(true) }
    : { label: '登录后保存记录', onClick: onLogin };

  return (
    <div className="min-h-screen overflow-hidden bg-[var(--homepage-bg)] text-[var(--homepage-ink)]">
      <div className="page-orbit" />

      <header className="sticky top-0 z-40 border-b border-stone-900/10 bg-[rgba(245,239,230,0.84)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-900 text-stone-50 shadow-[0_14px_28px_rgba(28,25,23,0.18)]">
              <Compass size={20} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-stone-500">Zhaxiaoji Studio</p>
              <p className="text-sm text-stone-700">{currentLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {isLoggedIn ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowStats(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-900/10 bg-white/70 px-4 py-2 text-sm text-stone-700 transition-colors hover:bg-white"
                >
                  <Trophy size={16} />
                  战绩
                </button>
                <button
                  type="button"
                  onClick={() => setShowTokenManager(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-900/10 bg-white/70 px-4 py-2 text-sm text-stone-700 transition-colors hover:bg-white"
                >
                  <KeyRound size={16} />
                  令牌
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm text-stone-50 transition-colors hover:bg-stone-800"
                >
                  <LogOut size={16} />
                  退出
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onGuestPlay}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-900/10 bg-white/70 px-4 py-2 text-sm text-stone-700 transition-colors hover:bg-white"
                >
                  <Ticket size={16} />
                  游客模式
                </button>
                <button
                  type="button"
                  onClick={onLogin}
                  className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm text-stone-50 transition-colors hover:bg-stone-800"
                >
                  <LogIn size={16} />
                  登录
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="paper-panel rounded-[38px] p-7 sm:p-10">
            <div className="mb-6 flex flex-wrap gap-3">
              <span className="rounded-full bg-stone-900 px-4 py-1.5 text-xs uppercase tracking-[0.28em] text-stone-50">
                Personal homepage
              </span>
              <span className="rounded-full border border-stone-900/10 px-4 py-1.5 text-xs uppercase tracking-[0.22em] text-stone-600">
                AI werewolf + projects + labs
              </span>
            </div>

            <BalancedHeadline
              text="把游戏、实验和长期项目放进同一个入口里。"
              className="font-display max-w-4xl text-[clamp(2.7rem,7vw,5.3rem)] leading-[0.96] tracking-[-0.05em] text-stone-950"
              lineClassName="headline-line"
              font='700 64px "Noto Serif SC"'
              lineHeight={72}
            />

            <p className="mt-6 max-w-2xl text-base leading-8 text-stone-600 sm:text-lg">
              这是 Zhaxiaoji Studio 的新版主页。狼人杀不再是整站唯一叙事，但它仍然可玩；项目站、实验页和工具模块也终于回到同一个首页里。
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={wolfgamePrimaryAction.onClick}
                className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-stone-50 transition-transform hover:-translate-y-0.5 hover:bg-stone-900"
              >
                <Swords size={18} />
                {wolfgamePrimaryAction.label}
              </button>
              <button
                type="button"
                onClick={onEnterSites}
                className="inline-flex items-center gap-2 rounded-full border border-stone-900/10 bg-white/70 px-5 py-3 text-sm font-medium text-stone-700 transition-transform hover:-translate-y-0.5 hover:bg-white"
              >
                <FlaskConical size={18} />
                浏览 Projects & Labs
              </button>
              <a
                href="/site/index.html"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 rounded-full border border-stone-900/10 bg-white/70 px-5 py-3 text-sm font-medium text-stone-700 transition-transform hover:-translate-y-0.5 hover:bg-white"
              >
                <Globe2 size={18} />
                打开静态个人站
              </a>
            </div>
          </div>

          <aside className="grid gap-4">
            <div className="paper-panel rounded-[30px] p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Now</p>
              <h2 className="font-display mt-4 text-3xl text-stone-950">这次改造保留了什么</h2>
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-stone-900/10 bg-white/60 p-4">
                  <p className="text-sm font-medium text-stone-900">狼人杀逻辑没有被重写</p>
                  <p className="mt-2 text-sm leading-7 text-stone-600">继续沿用原有的 SetupScreen、GameArena 和 reducer，只动外层入口和信息架构。</p>
                </div>
                <div className="rounded-2xl border border-stone-900/10 bg-white/60 p-4">
                  <p className="text-sm font-medium text-stone-900">首页变成公开访问</p>
                  <p className="mt-2 text-sm leading-7 text-stone-600">现在不登录也能先看到项目、实验和试玩入口，登录只负责增量能力。</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-[28px] bg-stone-950 p-5 text-stone-50 shadow-[0_20px_40px_rgba(28,25,23,0.16)]">
                <p className="text-xs uppercase tracking-[0.28em] text-stone-400">Access</p>
                <p className="mt-3 text-lg">{isLoggedIn ? '登录后可保存战绩和令牌。' : '不登录也能直接浏览主页。'}</p>
              </div>
              <div className="rounded-[28px] bg-[#0f4c46] p-5 text-emerald-50 shadow-[0_20px_40px_rgba(15,76,70,0.18)]">
                <p className="text-xs uppercase tracking-[0.28em] text-emerald-100/70">Playability</p>
                <p className="mt-3 text-lg">狼人杀现在有独立 hub，游客试玩与登录入口都从那里进入。</p>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-3">
          <HomePortalCard
            eyebrow="Playable"
            title="AI 狼人杀"
            description="模块首页先介绍玩法、入口和账户能力，再从 hub 进入游客试玩、人机混合和全 AI 对局。"
            badge="Hub"
            icon={Swords}
            tone="rust"
            primaryAction={wolfgamePrimaryAction}
            secondaryAction={wolfgameSecondaryAction}
          />

          <HomePortalCard
            eyebrow="Curated"
            title="Projects & Labs"
            description="把静态站、实时行情和后续实验放进同一个 hub，不再埋在“站点入口”这种模糊概念下面。"
            badge="Open"
            icon={Compass}
            tone="forest"
            primaryAction={{ label: '打开实验集合', onClick: onEnterSites }}
            secondaryAction={{ label: '静态站首页', href: '/site/index.html', external: true }}
          />

          <HomePortalCard
            eyebrow="State"
            title="登录与个人记录"
            description="登录后保留你的战绩、令牌和个人入口；不登录也能先把站点和试玩体验逛一遍。"
            badge={isLoggedIn ? 'Account' : 'Public'}
            icon={isLoggedIn ? UserCircle2 : Radar}
            tone="ink"
            primaryAction={isLoggedIn ? { label: '查看我的战绩', onClick: () => setShowStats(true) } : { label: '前往登录', onClick: onLogin }}
            secondaryAction={isLoggedIn ? { label: '管理令牌', onClick: () => setShowTokenManager(true) } : { label: '启用游客模式', onClick: onGuestPlay }}
          />
        </section>

        <section className="mt-14">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Measured notes</p>
              <h2 className="font-display mt-3 text-4xl text-stone-950">用 pretext 驱动的文本板</h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-stone-600">
              这一组卡片的最小高度由文本测量结果驱动，标题和说明不会靠拍脑袋估尺寸。首页 headline 也使用了相同思路的平衡换行。
            </p>
          </div>

          <IdeaMasonry items={noteItems} />
        </section>
      </main>

      <footer className="border-t border-stone-900/10 bg-white/50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-6 text-sm text-stone-600 sm:px-6">
          <a href="/about.html" className="transition-colors hover:text-stone-950">关于</a>
          <a href="/privacy.html" className="transition-colors hover:text-stone-950">隐私</a>
          <a href="/terms.html" className="transition-colors hover:text-stone-950">协议</a>
          <span className="ml-auto">© {new Date().getFullYear()} Zhaxiaoji Studio</span>
        </div>
      </footer>

      {showStats ? <UserStats onClose={() => setShowStats(false)} /> : null}
      {showTokenManager ? (
        <TokenManager
          onClose={() => setShowTokenManager(false)}
          onTokenSaved={() => {
            setShowTokenManager(false);
            verifyModelscopeToken();
          }}
        />
      ) : null}
    </div>
  );
}
