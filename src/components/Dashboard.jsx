import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { TokenManager } from './TokenManager';
import { UserStats } from './UserStats';
import {
  Gamepad2,
  LogOut,
  Trophy,
  Key,
  Ticket,
  ChevronRight,
  AlertCircle,
  Check,
  User,
  ExternalLink,
  Globe,
  LogIn,
  MessageSquare,
  Send,
  Sparkles,
} from 'lucide-react';
import { getUiCopy } from '../i18n/locale.js';

const FEEDBACK_MAX_LENGTH = 1000;

export function Dashboard({
  onEnterWolfgame,
  onEnterSites,
  onLogout,
  isGuestMode = false,
  onLogin,
  onGuestPlay,
  locale = 'zh',
}) {
  const { user, tokenStatus, verifyModelscopeToken } = useAuth();
  const copy = getUiCopy(locale).dashboard;
  const common = getUiCopy(locale).common;
  const appCopy = getUiCopy(locale).app;

  const [showTokenManager, setShowTokenManager] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackContact, setFeedbackContact] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const isLoggedIn = !!user;
  const needsTokenConfig = isLoggedIn && !isGuestMode && !(tokenStatus.hasToken && tokenStatus.isValid);
  const feedbackTrimmedLength = feedbackMessage.trim().length;
  const feedbackLength = feedbackMessage.length;
  const isFeedbackValid = feedbackTrimmedLength >= 5 && feedbackTrimmedLength <= FEEDBACK_MAX_LENGTH;
  const displayName = isGuestMode ? common.guest : (user?.username || common.unknown);
  const headerTitle = isGuestMode ? copy.guestMode : isLoggedIn ? `${copy.greetingPrefix}${displayName}` : copy.workspace;

  const handleEnterGame = () => {
    if (needsTokenConfig) {
      setShowTokenManager(true);
      return;
    }
    onEnterWolfgame?.();
  };

  const handleSubmitFeedback = async (event) => {
    event.preventDefault();
    setFeedbackStatus(null);

    if (!isFeedbackValid || feedbackLoading) {
      setFeedbackStatus({
        type: 'error',
        text: copy.feedbackValidation(FEEDBACK_MAX_LENGTH),
      });
      return;
    }

    setFeedbackLoading(true);
    try {
      const response = await authService.submitFeedback({
        message: feedbackMessage.trim(),
        contact: feedbackContact.trim(),
        username: isGuestMode ? common.guest : (user?.username || common.unknown),
        isGuest: isGuestMode,
        page: 'home',
      });

      if (response.success) {
        setFeedbackMessage('');
        setFeedbackContact('');
        setFeedbackStatus({ type: 'success', text: copy.feedbackSuccess });
      } else {
        setFeedbackStatus({ type: 'error', text: response.error || copy.feedbackError });
      }
    } catch (error) {
      setFeedbackStatus({ type: 'error', text: error.message || copy.feedbackError });
    } finally {
      setFeedbackLoading(false);
    }
  };

  return (
    <div className="px-4 py-24 md:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mac-window overflow-hidden">
          <div className="mac-toolbar">
            <div className="flex items-center gap-4">
              <div className="mac-window-chrome">
                <span className="mac-window-dot mac-dot-red" />
                <span className="mac-window-dot mac-dot-yellow" />
                <span className="mac-window-dot mac-dot-green" />
              </div>
              <div>
                <div className="mac-eyebrow">{copy.windowTitle}</div>
                <h1 className="text-lg font-semibold text-slate-900">
                  {headerTitle}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isGuestMode ? (
                <button
                  type="button"
                  onClick={onLogin}
                  aria-label={appCopy.login}
                  className="mac-button mac-button-secondary !h-11 !w-11 !rounded-2xl !p-0"
                  title={appCopy.login}
                >
                  <LogIn size={18} />
                </button>
              ) : isLoggedIn ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowStats(true)}
                    aria-label={copy.statsTitle}
                    className="mac-button mac-button-secondary !h-11 !w-11 !rounded-2xl !p-0"
                    title={copy.statsTitle}
                  >
                    <Trophy size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTokenManager(true)}
                    aria-label={copy.tokenTitle}
                    className="mac-button mac-button-secondary !h-11 !w-11 !rounded-2xl !p-0"
                    title={copy.tokenTitle}
                  >
                    <Key size={18} className={tokenStatus.hasToken ? 'text-emerald-600' : 'text-amber-600'} />
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    aria-label={appCopy.logout}
                    className="mac-button mac-button-secondary !h-11 !w-11 !rounded-2xl !p-0"
                    title={appCopy.logout}
                  >
                    <LogOut size={18} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onGuestPlay}
                    aria-label={appCopy.guestMode}
                    className="mac-button mac-button-secondary"
                    title={appCopy.guestMode}
                  >
                    <Ticket size={16} />
                    {appCopy.guestMode}
                  </button>
                  <button
                    type="button"
                    onClick={onLogin}
                    aria-label={appCopy.login}
                    className="mac-button mac-button-secondary !h-11 !w-11 !rounded-2xl !p-0"
                    title={appCopy.login}
                  >
                    <LogIn size={18} />
                  </button>
                </>
              )}
            </div>
          </div>

          <main className="space-y-8 px-6 py-6 lg:px-8 lg:py-8">
            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="mac-panel overflow-hidden p-6 md:p-8">
                <div className="mac-badge">
                  <Sparkles size={14} />
                  {copy.workspaceDescription}
                </div>
                <div className="mt-6 space-y-3">
                  <h2 className="text-4xl font-semibold tracking-tight text-slate-900">{copy.workspace}</h2>
                  <p className="max-w-2xl text-base leading-7 text-slate-500">{copy.windowSubtitle}</p>
                </div>

                <div className="mt-8 grid gap-4 md:grid-cols-3">
                  {copy.quickSteps.map((step) => (
                    <div key={step.title} className="rounded-[24px] border border-white/70 bg-white/78 p-4 shadow-[0_12px_28px_rgba(68,85,119,0.08)]">
                      <div className="text-sm font-semibold text-slate-900">{step.title}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-500">{step.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[28px] border border-amber-200/80 bg-white/76 p-6 shadow-[0_22px_42px_rgba(255,179,84,0.14)]">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/25">
                      <Gamepad2 size={28} />
                    </div>
                    <span className={`mac-badge ${needsTokenConfig ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {needsTokenConfig ? <AlertCircle size={14} /> : <Check size={14} />}
                      {needsTokenConfig ? copy.tokenNeeded : copy.gameReady}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900">{copy.gameCardTitle}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{copy.gameCardDescription}</p>
                  {needsTokenConfig && (
                    <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50/90 p-4 text-sm leading-6 text-amber-900">
                      {copy.tokenHint}
                      <button type="button" onClick={() => setShowTokenManager(true)} className="ml-2 font-semibold underline">
                        {copy.configureNow}
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleEnterGame}
                    className={`mac-button mt-6 w-full justify-between ${needsTokenConfig ? 'mac-button-secondary' : 'mac-button-primary'}`}
                  >
                    <span>{needsTokenConfig ? copy.openToken : copy.startMatch}</span>
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="rounded-[28px] border border-sky-200/80 bg-white/76 p-6 shadow-[0_22px_42px_rgba(40,121,255,0.12)]">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-lg shadow-sky-500/25">
                      <Globe size={28} />
                    </div>
                    <span className="mac-badge text-sky-700">{copy.sitesBadge}</span>
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900">{copy.sitesTitle}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{copy.sitesDescription}</p>
                  <button type="button" onClick={onEnterSites} className="mac-button mac-button-primary mt-6 w-full justify-between">
                    <span>{copy.enterSites}</span>
                    <ExternalLink size={16} />
                  </button>
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="mac-panel p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/20">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{copy.feedbackTitle}</h3>
                    <p className="text-sm text-slate-500">{copy.feedbackDescription}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmitFeedback} className="grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{copy.feedbackLabel}</label>
                    <textarea
                      className="mac-textarea mt-2 min-h-[180px]"
                      placeholder={copy.feedbackPlaceholder}
                      value={feedbackMessage}
                      onChange={(event) => setFeedbackMessage(event.target.value)}
                      maxLength={FEEDBACK_MAX_LENGTH}
                    />
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                      <span>{feedbackLength}/{FEEDBACK_MAX_LENGTH}</span>
                      <span>{copy.feedbackSafe}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{copy.feedbackContact}</label>
                      <input
                        type="text"
                        className="mac-input mt-2"
                        placeholder={copy.feedbackContactPlaceholder}
                        value={feedbackContact}
                        onChange={(event) => setFeedbackContact(event.target.value)}
                      />
                    </div>

                    <div className="rounded-[22px] border border-slate-200 bg-white/80 p-4 text-sm text-slate-500">
                      {copy.feedbackIdentity}: <span className="font-semibold text-slate-900">{displayName}</span>
                    </div>

                    <button
                      type="submit"
                      disabled={!isFeedbackValid || feedbackLoading}
                      className={`mac-button w-full justify-between ${isFeedbackValid && !feedbackLoading ? 'mac-button-primary' : 'mac-button-secondary'}`}
                    >
                      <span>{feedbackLoading ? copy.feedbackSending : copy.feedbackSend}</span>
                      <Send size={16} />
                    </button>

                    {feedbackStatus && (
                      <div className={`text-sm ${feedbackStatus.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {feedbackStatus.text}
                      </div>
                    )}
                  </div>
                </form>
              </div>

              <div className="mac-panel p-6">
                <div className="mac-eyebrow">{copy.moreFeatures}</div>
                <div className="mt-4 grid gap-3">
                  {!isGuestMode ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowStats(true)}
                        className="rounded-[22px] border border-white/80 bg-white/78 p-4 text-left shadow-[0_12px_28px_rgba(68,85,119,0.08)] transition-all hover:-translate-y-1"
                      >
                        <Trophy size={22} className="text-amber-500" />
                        <p className="mt-3 font-semibold text-slate-900">{copy.statsTitle}</p>
                        <p className="mt-1 text-sm text-slate-500">{copy.statsDescription}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowTokenManager(true)}
                        className="rounded-[22px] border border-white/80 bg-white/78 p-4 text-left shadow-[0_12px_28px_rgba(68,85,119,0.08)] transition-all hover:-translate-y-1"
                      >
                        <Key size={22} className="text-sky-500" />
                        <p className="mt-3 font-semibold text-slate-900">{copy.tokenTitle}</p>
                        <p className="mt-1 text-sm text-slate-500">{copy.tokenDescription}</p>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="rounded-[22px] border border-white/80 bg-white/78 p-4 shadow-[0_12px_28px_rgba(68,85,119,0.08)]">
                        <User size={22} className="text-slate-500" />
                        <p className="mt-3 font-semibold text-slate-900">{copy.guestCardTitle}</p>
                        <p className="mt-1 text-sm text-slate-500">{copy.guestCardDescription}</p>
                      </div>
                      <div className="rounded-[22px] border border-white/80 bg-white/78 p-4 shadow-[0_12px_28px_rgba(68,85,119,0.08)]">
                        <LogIn size={22} className="text-sky-500" />
                        <p className="mt-3 font-semibold text-slate-900">{copy.loginUnlockTitle}</p>
                        <p className="mt-1 text-sm text-slate-500">{copy.loginUnlockDescription}</p>
                      </div>
                    </>
                  )}

                  {[0, 1].map((index) => (
                    <div
                      key={index}
                      className="rounded-[22px] border border-dashed border-slate-300 bg-white/48 p-4 text-slate-400"
                    >
                      <p className="font-semibold">{copy.comingSoon}</p>
                      <p className="mt-1 text-sm">{copy.inDevelopment}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </main>
        </div>

        <footer className="mt-6 flex flex-wrap items-center gap-4 px-2 text-sm text-slate-500">
          <a href="/about.html" className="hover:text-slate-700 transition-colors">{copy.footerAbout}</a>
          <a href="/privacy.html" className="hover:text-slate-700 transition-colors">{copy.footerPrivacy}</a>
          <a href="/terms.html" className="hover:text-slate-700 transition-colors">{copy.footerTerms}</a>
          <span className="ml-auto">© {new Date().getFullYear()} Werewolf Pro</span>
        </footer>
      </div>

      {showStats && <UserStats onClose={() => setShowStats(false)} locale={locale} />}
      {showTokenManager && (
        <TokenManager
          locale={locale}
          onClose={() => setShowTokenManager(false)}
          onTokenSaved={() => {
            setShowTokenManager(false);
            verifyModelscopeToken();
          }}
        />
      )}
    </div>
  );
}
