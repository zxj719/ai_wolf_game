import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  KeyRound,
  LogIn,
  Radar,
  Route,
  Swords,
  Ticket,
  Trophy,
  Waypoints,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TokenManager } from './TokenManager';
import { UserStats } from './UserStats';
import { BalancedHeadline } from './home/BalancedHeadline';
import { HomePortalCard } from './home/HomePortalCard';
import { IdeaMasonry } from './home/IdeaMasonry';

export function WolfgameHub({
  onBackHome,
  onEnterWolfgame,
  onGuestWolfgame,
  onLogin,
  isGuestMode = false,
}) {
  const { user, tokenStatus, verifyModelscopeToken } = useAuth();
  const [showTokenManager, setShowTokenManager] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const isLoggedIn = !!user;
  const currentLabel = isGuestMode
    ? 'Guest mode is active'
    : isLoggedIn
      ? `Signed in as ${user?.username}`
      : 'Public module hub';

  const primaryAction = isLoggedIn || isGuestMode
    ? { label: isGuestMode && !isLoggedIn ? '继续游客试玩' : '进入对局设置', onClick: onEnterWolfgame }
    : { label: '游客试玩', onClick: onGuestWolfgame };

  const accountAction = isLoggedIn
    ? { label: '查看我的战绩', onClick: () => setShowStats(true) }
    : { label: '登录后保存战绩', onClick: onLogin };

  const noteItems = useMemo(() => ([
    {
      category: 'Public route',
      title: '`/wolfgame` 先解释玩法和入口，再决定怎么开始玩。',
      description: '这个页面是公开 hub，不直接承载配置表单和对局状态。先把游客试玩、账户能力和入口结构讲清楚，再进入后续流程。',
      meta: 'Hub first, setup second',
    },
    {
      category: 'Guest mode',
      title: '没有账号也可以直接试一局。',
      description: '游客从这里进入配置页，不需要先经过登录。试玩目标是先确认流程、角色组合和节奏，再决定要不要保存长期记录。',
      meta: 'Guest-ready entry',
    },
    {
      category: 'Account',
      title: '登录只负责增量能力，不再拦住首页入口。',
      description: '登录后继续保存战绩、查看个人记录、配置 ModelScope 令牌。玩法入口本身保持公开，体验不会被门禁卡住。',
      meta: 'Records + token management',
    },
    {
      category: 'Route map',
      title: '`/wolfgame/custom` 和 `/wolfgame/play` 继续沿用原流程。',
      description: '这次只重做狼人杀模块的外层壳层，不重写 SetupScreen、GameArena 或对局 reducer。玩法逻辑和现有流程仍然保留。',
      meta: 'Keep the engine',
    },
  ]), []);

  return (
    <div className="min-h-screen overflow-hidden bg-[var(--homepage-bg)] text-[var(--homepage-ink)]">
      <div className="page-orbit" />

      <header className="sticky top-0 z-40 border-b border-stone-900/10 bg-[rgba(245,239,230,0.84)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-900 text-stone-50 shadow-[0_14px_28px_rgba(28,25,23,0.18)]">
              <Swords size={20} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-stone-500">Wolfgame module</p>
              <p className="text-sm text-stone-700">{currentLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex items-center gap-2 rounded-full border border-stone-900/10 bg-white/70 px-4 py-2 text-sm text-stone-700 transition-colors hover:bg-white"
            >
              <ArrowLeft size={16} />
              返回首页
            </button>

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
                  className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm text-stone-50 transition-colors hover:bg-stone-800"
                >
                  <KeyRound size={16} />
                  {tokenStatus.hasToken ? '令牌' : '配置令牌'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onLogin}
                className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm text-stone-50 transition-colors hover:bg-stone-800"
              >
                <LogIn size={16} />
                登录
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="paper-panel rounded-[38px] p-7 sm:p-10">
            <div className="mb-6 flex flex-wrap gap-3">
              <span className="rounded-full bg-stone-900 px-4 py-1.5 text-xs uppercase tracking-[0.28em] text-stone-50">
                Public hub
              </span>
              <span className="rounded-full border border-stone-900/10 px-4 py-1.5 text-xs uppercase tracking-[0.22em] text-stone-600">
                setup + play remain downstream
              </span>
            </div>

            <BalancedHeadline
              text="先把狼人杀模块讲清楚，再决定是游客试玩还是登录后进入。"
              className="font-display max-w-4xl text-[clamp(2.5rem,6vw,4.9rem)] leading-[0.96] tracking-[-0.05em] text-stone-950"
              lineClassName="headline-line"
              font='700 60px "Noto Serif SC"'
              lineHeight={68}
            />

            <p className="mt-6 max-w-2xl text-base leading-8 text-stone-600 sm:text-lg">
              这个页面是公开的狼人杀模块首页。`/wolfgame` 负责说明玩法、入口和账户能力；真正的配置与对局仍然在
              ` /wolfgame/custom ` 和 ` /wolfgame/play ` 里继续进行。
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={primaryAction.onClick}
                className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-medium text-stone-50 transition-transform hover:-translate-y-0.5 hover:bg-stone-900"
              >
                {isLoggedIn || isGuestMode ? <Swords size={18} /> : <Ticket size={18} />}
                {primaryAction.label}
              </button>

              <button
                type="button"
                onClick={accountAction.onClick}
                className="inline-flex items-center gap-2 rounded-full border border-stone-900/10 bg-white/70 px-5 py-3 text-sm font-medium text-stone-700 transition-transform hover:-translate-y-0.5 hover:bg-white"
              >
                {isLoggedIn ? <Trophy size={18} /> : <LogIn size={18} />}
                {accountAction.label}
              </button>
            </div>
          </div>

          <aside className="grid gap-4">
            <div className="paper-panel rounded-[30px] p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Route contract</p>
              <h2 className="font-display mt-4 text-3xl text-stone-950">公开入口和私有对局已经拆开</h2>
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-stone-900/10 bg-white/60 p-4">
                  <p className="text-sm font-medium text-stone-900">`/wolfgame` 是公开 hub</p>
                  <p className="mt-2 text-sm leading-7 text-stone-600">任何人都能先看玩法说明、试玩入口和账户能力，不需要先登录。</p>
                </div>
                <div className="rounded-2xl border border-stone-900/10 bg-white/60 p-4">
                  <p className="text-sm font-medium text-stone-900">`/wolfgame/custom` 与 `/wolfgame/play` 保留现状</p>
                  <p className="mt-2 text-sm leading-7 text-stone-600">配置页和对局页继续沿用原流程，这次不动狼人杀引擎和局内逻辑。</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-[28px] bg-stone-950 p-5 text-stone-50 shadow-[0_20px_40px_rgba(28,25,23,0.16)]">
                <p className="text-xs uppercase tracking-[0.28em] text-stone-400">Entry</p>
                <p className="mt-3 text-lg">{isGuestMode ? '你现在已经处于游客模式。' : '游客可以从这里直接开始试玩。'}</p>
              </div>
              <div className="rounded-[28px] bg-[#0f4c46] p-5 text-emerald-50 shadow-[0_20px_40px_rgba(15,76,70,0.18)]">
                <p className="text-xs uppercase tracking-[0.28em] text-emerald-100/70">Account</p>
                <p className="mt-3 text-lg">{isLoggedIn ? '战绩和令牌入口都已经挂在这个模块页里。' : '登录后会解锁保存战绩和令牌管理。'}</p>
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-3">
          <HomePortalCard
            eyebrow="Playable"
            title="游客试玩"
            description="不登录也能进入配置页开一局，先体验角色组合、对局节奏和 AI 推理，再决定是否沉淀长期记录。"
            badge="Open"
            icon={Ticket}
            tone="rust"
            primaryAction={isLoggedIn || isGuestMode ? { label: '进入对局设置', onClick: onEnterWolfgame } : { label: '游客试玩', onClick: onGuestWolfgame }}
            secondaryAction={!isLoggedIn && !isGuestMode ? { label: '返回个人主页', onClick: onBackHome } : undefined}
          />

          <HomePortalCard
            eyebrow="State"
            title="账户能力"
            description="登录后可以保存狼人杀战绩、查看自己的记录，并管理 ModelScope 令牌；未登录时入口仍然公开。"
            badge={isLoggedIn ? 'Account' : 'Optional'}
            icon={Radar}
            tone="ink"
            primaryAction={isLoggedIn ? { label: '查看我的战绩', onClick: () => setShowStats(true) } : { label: '前往登录', onClick: onLogin }}
            secondaryAction={isLoggedIn ? { label: tokenStatus.hasToken ? '管理令牌' : '配置令牌', onClick: () => setShowTokenManager(true) } : undefined}
          />

          <HomePortalCard
            eyebrow="IA"
            title="路由结构"
            description="公开 hub 负责解释和分发入口；真正的设置和对局状态仍然在原来的 `/wolfgame/custom` 与 `/wolfgame/play`。"
            badge="Routes"
            icon={Route}
            tone="forest"
            primaryAction={{ label: '返回个人主页', onClick: onBackHome }}
            secondaryAction={{ label: '开始一局', onClick: primaryAction.onClick }}
          />
        </section>

        <section className="mt-14">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Measured notes</p>
              <h2 className="font-display mt-3 text-4xl text-stone-950">用同一套 pretext 排版规则写狼人杀模块</h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-stone-600">
              这个 hub 不再像一张孤立的深色工具页，而是回到首页同一套编辑式结构里。标题和平铺文本都继续使用 pretext 相关组件来控制版面。
            </p>
          </div>

          <IdeaMasonry items={noteItems} />
        </section>

        <section className="mt-14 rounded-[32px] border border-stone-900/10 bg-white/65 p-6 shadow-[0_24px_50px_rgba(28,25,23,0.08)] backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Flow</p>
              <h2 className="font-display mt-3 text-3xl text-stone-950">公开 hub，进入配置页，再进入对局页</h2>
              <p className="mt-4 text-sm leading-7 text-stone-600">
                这一层只处理信息架构，不抢对局逻辑。点击开始后，仍然回到原来的狼人杀配置与游戏流程里。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-stone-900/10 bg-[#fff7ec] px-4 py-2 text-sm text-stone-700">
                <Waypoints size={16} />
                /wolfgame
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-stone-900/10 bg-[#f4fbf7] px-4 py-2 text-sm text-stone-700">
                <Waypoints size={16} />
                /wolfgame/custom
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-stone-900/10 bg-[#f7f4ff] px-4 py-2 text-sm text-stone-700">
                <Waypoints size={16} />
                /wolfgame/play
              </div>
            </div>
          </div>
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
