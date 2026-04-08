import { ArrowLeft, KeyRound, LogIn, Swords, Ticket, Trophy, Waypoints } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TokenManager } from './TokenManager';
import { UserStats } from './UserStats';

function getCopy(locale) {
  if (locale === 'en') {
    return {
      title: 'AI Werewolf',
      subtitle: 'A public module page before you enter setup.',
      description: 'Guest mode stays open. Accounts add saved stats and token management. The actual match setup and gameplay remain in the existing downstream routes.',
      back: 'Back',
      startGuest: 'Try as guest',
      continueGuest: 'Continue as guest',
      startSetup: 'Open setup',
      login: 'Log in',
      stats: 'Stats',
      token: 'Token',
      tokenSetup: 'Set up token',
      signedIn: (name) => `Signed in as ${name}`,
      guest: 'Guest mode is active',
      public: 'Public module page',
      notes: [
        { title: 'Public route', body: 'This page explains the entry points before the match starts.' },
        { title: 'Downstream flow', body: '`/wolfgame/custom` and `/wolfgame/play` still handle setup and gameplay.' },
        { title: 'Account layer', body: 'Accounts only add stats and token storage. They do not block guest play.' },
      ],
    };
  }

  return {
    title: 'AI 狼人杀',
    subtitle: '先进入公开模块页，再进入对局设置。',
    description: '游客模式保持开放，账号只增加战绩和令牌管理。真正的设置和对局流程仍然走现有的下游路由。',
    back: '返回',
    startGuest: '游客试玩',
    continueGuest: '继续游客模式',
    startSetup: '进入设置',
    login: '登录',
    stats: '战绩',
    token: '令牌',
    tokenSetup: '配置令牌',
    signedIn: (name) => `当前账号：${name}`,
    guest: '当前为游客模式',
    public: '公开模块页',
    notes: [
      { title: '公开入口', body: '这里先解释玩法和入口，再决定是否进入设置。' },
      { title: '下游流程', body: '`/wolfgame/custom` 和 `/wolfgame/play` 继续负责设置与对局。' },
      { title: '账号层', body: '登录只负责战绩和令牌，不会阻挡游客试玩。' },
    ],
  };
}

export function WolfgameHub({
  onBackHome,
  onEnterWolfgame,
  onGuestWolfgame,
  onLogin,
  isGuestMode = false,
  locale = 'zh',
}) {
  const { user, tokenStatus, verifyModelscopeToken } = useAuth();
  const [showTokenManager, setShowTokenManager] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const copy = getCopy(locale);

  const isLoggedIn = !!user;
  const statusLabel = isGuestMode
    ? copy.guest
    : isLoggedIn
      ? copy.signedIn(user?.username)
      : copy.public;

  const primaryLabel = isLoggedIn || isGuestMode ? (isGuestMode && !isLoggedIn ? copy.continueGuest : copy.startSetup) : copy.startGuest;
  const primaryAction = isLoggedIn || isGuestMode ? onEnterWolfgame : onGuestWolfgame;

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
                <div className="mac-eyebrow">Wolfgame</div>
                <h1 className="text-base font-semibold text-slate-900">{statusLabel}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={onBackHome} className="mac-button mac-button-secondary">
                <ArrowLeft size={15} />
                {copy.back}
              </button>
              {isLoggedIn ? (
                <>
                  <button type="button" onClick={() => setShowStats(true)} className="mac-button mac-button-secondary">
                    <Trophy size={15} />
                    {copy.stats}
                  </button>
                  <button type="button" onClick={() => setShowTokenManager(true)} className="mac-button mac-button-secondary">
                    <KeyRound size={15} />
                    {tokenStatus.hasToken ? copy.token : copy.tokenSetup}
                  </button>
                </>
              ) : (
                <button type="button" onClick={onLogin} className="mac-button mac-button-secondary">
                  <LogIn size={15} />
                  {copy.login}
                </button>
              )}
            </div>
          </div>

          <main className="grid gap-8 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
            <section className="space-y-6">
              <div className="space-y-4">
                <div className="mac-eyebrow">{copy.subtitle}</div>
                <h2 className="text-[clamp(2.25rem,5vw,3.75rem)] font-semibold tracking-tight text-slate-950">
                  {copy.title}
                </h2>
                <p className="max-w-2xl text-base leading-7 text-slate-500">{copy.description}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={primaryAction} className="mac-button mac-button-primary">
                  {isLoggedIn || isGuestMode ? <Swords size={16} /> : <Ticket size={16} />}
                  {primaryLabel}
                </button>
                {!isLoggedIn && !isGuestMode && (
                  <button type="button" onClick={onLogin} className="mac-button mac-button-secondary">
                    <LogIn size={16} />
                    {copy.login}
                  </button>
                )}
              </div>

              <div className="mac-panel p-5">
                <div className="mac-eyebrow">Routes</div>
                <div className="mt-4 space-y-3">
                  {['/wolfgame', '/wolfgame/custom', '/wolfgame/play'].map((route) => (
                    <div key={route} className="mac-list-row">
                      <div className="flex items-center gap-3">
                        <span className="mac-icon-tile h-9 w-9 rounded-[14px]">
                          <Waypoints size={16} />
                        </span>
                        <code className="text-sm font-medium text-slate-900">{route}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="space-y-3">
              {copy.notes.map((note) => (
                <div key={note.title} className="mac-muted-card">
                  <div className="text-sm font-semibold text-slate-900">{note.title}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">{note.body}</div>
                </div>
              ))}
            </aside>
          </main>
        </div>
      </div>

      {showStats ? <UserStats onClose={() => setShowStats(false)} locale={locale} /> : null}
      {showTokenManager ? (
        <TokenManager
          locale={locale}
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
