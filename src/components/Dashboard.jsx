import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { TokenManager } from './TokenManager';
import { UserStats } from './UserStats';
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Gamepad2,
  Globe,
  Key,
  LogIn,
  LogOut,
  MessageSquare,
  PenLine,
  Ticket,
  Trophy,
  User,
} from 'lucide-react';
import { getUiCopy } from '../i18n/locale.js';

const FEEDBACK_MAX_LENGTH = 1000;

function UtilityButton({ icon: Icon, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mac-list-row w-full text-left transition-colors hover:bg-white/90"
    >
      <div className="flex items-center gap-3">
        <span className="mac-icon-tile h-10 w-10 rounded-[16px]">
          <Icon size={18} />
        </span>
        <div>
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <div className="text-sm text-slate-500">{description}</div>
        </div>
      </div>
      <ChevronRight size={16} className="text-slate-400" />
    </button>
  );
}

export function Dashboard({
  onEnterWolfgame,
  onEnterSites,
  onEnterNovel,
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
  const headerTitle = isGuestMode ? copy.guestMode : isLoggedIn ? `${copy.greetingPrefix}${displayName}` : copy.windowTitle;

  const handleEnterGame = () => onEnterWolfgame?.();

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
                <h1 className="text-base font-semibold text-slate-900">{headerTitle}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isGuestMode ? (
                <button
                  type="button"
                  onClick={onLogin}
                  aria-label={appCopy.login}
                  className="mac-button mac-button-secondary !h-10 !w-10 !rounded-[16px] !p-0"
                  title={appCopy.login}
                >
                  <LogIn size={17} />
                </button>
              ) : isLoggedIn ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowStats(true)}
                    aria-label={copy.statsTitle}
                    className="mac-button mac-button-secondary !h-10 !w-10 !rounded-[16px] !p-0"
                    title={copy.statsTitle}
                  >
                    <Trophy size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTokenManager(true)}
                    aria-label={copy.tokenTitle}
                    className="mac-button mac-button-secondary !h-10 !w-10 !rounded-[16px] !p-0"
                    title={copy.tokenTitle}
                  >
                    <Key size={17} className={tokenStatus.hasToken ? 'text-slate-700' : 'text-slate-400'} />
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    aria-label={appCopy.logout}
                    className="mac-button mac-button-secondary !h-10 !w-10 !rounded-[16px] !p-0"
                    title={appCopy.logout}
                  >
                    <LogOut size={17} />
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
                    <Ticket size={15} />
                    {appCopy.guestMode}
                  </button>
                  <button
                    type="button"
                    onClick={onLogin}
                    aria-label={appCopy.login}
                    className="mac-button mac-button-secondary !h-10 !w-10 !rounded-[16px] !p-0"
                    title={appCopy.login}
                  >
                    <LogIn size={17} />
                  </button>
                </>
              )}
            </div>
          </div>

          <main className="grid gap-8 px-6 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
            <section className="space-y-8">
              <div className="space-y-4">
                <div className="mac-eyebrow">{copy.workspaceDescription}</div>
                <h2 className="text-[clamp(2.25rem,5vw,4rem)] font-semibold tracking-tight text-slate-950">
                  {copy.workspace}
                </h2>
                <p className="max-w-2xl text-base leading-7 text-slate-500">{copy.windowSubtitle}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleEnterGame}
                  className="mac-button mac-button-primary"
                >
                  <Gamepad2 size={16} />
                  {copy.startMatch}
                </button>
                <button type="button" onClick={onEnterSites} className="mac-button mac-button-secondary">
                  <Globe size={16} />
                  {copy.enterSites}
                </button>
                {isLoggedIn && !isGuestMode && (
                  <button type="button" onClick={onEnterNovel} className="mac-button mac-button-secondary">
                    <PenLine size={16} />
                    小说工作台
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {copy.quickSteps.map((step) => (
                  <div key={step.title} className="mac-muted-card">
                    <div className="text-sm font-semibold text-slate-900">{step.title}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-500">{step.description}</div>
                  </div>
                ))}
              </div>

              <div className="mac-panel p-5 md:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="mac-icon-tile">
                    <MessageSquare size={18} />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{copy.feedbackTitle}</h3>
                    <p className="text-sm text-slate-500">{copy.feedbackDescription}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmitFeedback} className="grid gap-4">
                  <div>
                    <textarea
                      className="mac-textarea min-h-[140px]"
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

                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <input
                      type="text"
                      className="mac-input"
                      placeholder={copy.feedbackContactPlaceholder}
                      value={feedbackContact}
                      onChange={(event) => setFeedbackContact(event.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={!isFeedbackValid || feedbackLoading}
                      className={`mac-button min-w-[156px] ${isFeedbackValid && !feedbackLoading ? 'mac-button-primary' : 'mac-button-secondary'}`}
                    >
                      {feedbackLoading ? copy.feedbackSending : copy.feedbackSend}
                      <ArrowUpRight size={15} />
                    </button>
                  </div>

                  {feedbackStatus && (
                    <div className={`text-sm ${feedbackStatus.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {feedbackStatus.text}
                    </div>
                  )}
                </form>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="mac-panel p-5">
                <div className="mac-eyebrow">{copy.windowTitle}</div>
                <div className="mt-4 space-y-3">
                  <div className="mac-list-row">
                    <div className="flex items-center gap-3">
                      <span className="mac-icon-tile h-10 w-10 rounded-[16px]">
                        <Gamepad2 size={17} />
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{copy.gameCardTitle}</div>
                        <div className="text-sm text-slate-500">{copy.gameCardDescription}</div>
                      </div>
                    </div>
                    {!needsTokenConfig && <Check size={16} className="text-emerald-600" />}
                  </div>

                  {needsTokenConfig && (
                    <div className="rounded-[18px] border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-800">
                      {copy.tokenHint}
                    </div>
                  )}

                  <div className="rounded-[18px] border border-slate-200/80 bg-white/68 px-4 py-3 text-sm leading-6 text-slate-500">
                    {copy.feedbackIdentity}: <span className="font-medium text-slate-900">{displayName}</span>
                  </div>
                </div>
              </div>

              <div className="mac-panel p-5">
                <div className="mac-eyebrow">{copy.moreFeatures}</div>
                <div className="mt-4 space-y-3">
                  {!isGuestMode ? (
                    <>
                      <UtilityButton
                        icon={Trophy}
                        title={copy.statsTitle}
                        description={copy.statsDescription}
                        onClick={() => setShowStats(true)}
                      />
                      <UtilityButton
                        icon={Key}
                        title={copy.tokenTitle}
                        description={copy.tokenDescription}
                        onClick={() => setShowTokenManager(true)}
                      />
                    </>
                  ) : (
                    <>
                      <div className="mac-list-row">
                        <div className="flex items-center gap-3">
                          <span className="mac-icon-tile h-10 w-10 rounded-[16px]">
                            <User size={17} />
                          </span>
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{copy.guestCardTitle}</div>
                            <div className="text-sm text-slate-500">{copy.guestCardDescription}</div>
                          </div>
                        </div>
                      </div>
                      <UtilityButton
                        icon={LogIn}
                        title={copy.loginUnlockTitle}
                        description={copy.loginUnlockDescription}
                        onClick={onLogin}
                      />
                    </>
                  )}
                </div>
              </div>
            </aside>
          </main>
        </div>

        <footer className="mt-4 flex flex-wrap items-center gap-4 px-2 text-sm text-slate-500">
          <a href="/about.html" className="transition-colors hover:text-slate-700">{copy.footerAbout}</a>
          <a href="/privacy.html" className="transition-colors hover:text-slate-700">{copy.footerPrivacy}</a>
          <a href="/terms.html" className="transition-colors hover:text-slate-700">{copy.footerTerms}</a>
          <span className="ml-auto">(c) {new Date().getFullYear()} Zhaxiaoji Studio</span>
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
