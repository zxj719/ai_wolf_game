import React from 'react';
import {
  User,
  Brain,
  AlertTriangle,
  Key,
  ExternalLink,
  Swords,
  Shield,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { API_KEY } from '../config/aiConfig';
import { RoleSelector } from './RoleSelector';
import {
  validateRoleConfig,
  generateNightSequence,
  buildRolesArray,
  DEFAULT_CUSTOM_SELECTIONS,
  DEFAULT_VICTORY_MODE,
} from '../config/roles';
import { getUiCopy, getVictoryModeCopy } from '../i18n/locale.js';

export function SetupScreen({
  gameMode,
  setGameMode,
  isLoggedIn = false,
  isGuestMode = false,
  hasModelscopeToken = false,
  onConfigureToken = null,
  customRoleSelections = DEFAULT_CUSTOM_SELECTIONS,
  setCustomRoleSelections = () => {},
  onBuildCustomSetup = null,
  victoryMode = DEFAULT_VICTORY_MODE,
  setVictoryMode = () => {},
  onExit = null,
  exitLabel,
  locale = 'zh',
}) {
  const copy = getUiCopy(locale).setup;
  const common = getUiCopy(locale).common;

  const needsTokenConfig = isLoggedIn && !isGuestMode && !hasModelscopeToken;
  const customValidation = validateRoleConfig(customRoleSelections);
  const hasApiAccess = isGuestMode ? !!API_KEY : hasModelscopeToken || !!API_KEY;
  const canStartGame = hasApiAccess && customValidation.isValid;

  const edgeCopy = getVictoryModeCopy('edge', locale);
  const townCopy = getVictoryModeCopy('town', locale);

  const handleStartGame = (mode) => {
    if (onBuildCustomSetup) {
      const rolesArray = buildRolesArray(customRoleSelections);
      onBuildCustomSetup({
        id: 'custom',
        name: locale === 'en' ? 'Custom Match' : '自定义局',
        TOTAL_PLAYERS: rolesArray.length,
        STANDARD_ROLES: rolesArray,
        NIGHT_SEQUENCE: generateNightSequence(customRoleSelections),
        description: '',
        isCustom: true,
      });
    }
    setGameMode(mode);
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
                <div className="mac-eyebrow">Werewolf Pro</div>
                <h1 className="mac-title mt-1">{copy.title}</h1>
              </div>
            </div>

            {onExit && (
              <button type="button" onClick={onExit} className="mac-button mac-button-secondary">
                <ArrowLeft size={16} />
                {exitLabel || getUiCopy(locale).app.backHome}
              </button>
            )}
          </div>

          <div className="grid gap-8 px-6 py-6 lg:grid-cols-[1.05fr_1.45fr] lg:px-8 lg:py-8">
            <section className="space-y-6">
              <div className="mac-panel p-6">
                <div className="mac-badge">
                  <Sparkles size={14} />
                  {copy.subtitle}
                </div>
                <div className="mt-4 space-y-3">
                  <h2 className="text-2xl font-semibold text-slate-900">{copy.chooseMode}</h2>
                  <p className="mac-section-copy">{copy.bannerDescription}</p>
                </div>
              </div>

              {(needsTokenConfig && !API_KEY) && (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50/90 p-5 shadow-[0_14px_30px_rgba(255,178,74,0.15)]">
                  <div className="flex items-start gap-3">
                    <Key className="mt-0.5 text-amber-600" size={20} />
                    <div>
                      <h3 className="text-base font-semibold text-amber-900">{copy.tokenTitle}</h3>
                      <p className="mt-1 text-sm leading-6 text-amber-800">{copy.tokenDescription}</p>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        {onConfigureToken && (
                          <button type="button" onClick={onConfigureToken} className="mac-button mac-button-primary">
                            {copy.tokenButton}
                          </button>
                        )}
                        <a
                          href="https://modelscope.cn/my/access/token"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mac-button mac-button-secondary"
                        >
                          {copy.tokenLink}
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isGuestMode && !API_KEY && (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50/90 p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 text-amber-600" size={20} />
                    <div>
                      <h3 className="text-base font-semibold text-amber-900">{copy.guestTokenTitle}</h3>
                      <p className="mt-1 text-sm leading-6 text-amber-800">{copy.guestTokenDescription}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleStartGame('player')}
                  disabled={!canStartGame}
                  className="rounded-[28px] border border-emerald-300/60 bg-white/70 p-6 text-left shadow-[0_18px_40px_rgba(41,167,107,0.12)] transition-all hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
                    <User size={24} />
                  </div>
                  <div className="text-lg font-semibold text-slate-900">{copy.playerMode}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">{copy.playerModeDescription}</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleStartGame('ai-only')}
                  disabled={!canStartGame}
                  className="rounded-[28px] border border-sky-300/60 bg-white/70 p-6 text-left shadow-[0_18px_40px_rgba(40,121,255,0.12)] transition-all hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-lg shadow-sky-500/25">
                    <Brain size={24} />
                  </div>
                  <div className="text-lg font-semibold text-slate-900">{copy.aiMode}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">{copy.aiModeDescription(customValidation.total)}</div>
                </button>
              </div>

              <div className="mac-panel p-5">
                <div className="mac-eyebrow">{copy.victoryRule}</div>
                <div className="mt-4 grid gap-3">
                  <button
                    type="button"
                    onClick={() => setVictoryMode('edge')}
                    className={`rounded-[22px] border p-4 text-left transition-all ${
                      victoryMode === 'edge'
                        ? 'border-rose-300 bg-rose-50 shadow-[0_14px_28px_rgba(234,78,70,0.12)]'
                        : 'bg-white/70 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500 text-white">
                        <Swords size={18} />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{edgeCopy.name}</div>
                        <div className="mt-1 text-sm text-slate-500">{edgeCopy.description}</div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVictoryMode('town')}
                    className={`rounded-[22px] border p-4 text-left transition-all ${
                      victoryMode === 'town'
                        ? 'border-sky-300 bg-sky-50 shadow-[0_14px_28px_rgba(40,121,255,0.12)]'
                        : 'bg-white/70 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500 text-white">
                        <Shield size={18} />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{townCopy.name}</div>
                        <div className="mt-1 text-sm text-slate-500">{townCopy.description}</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="rounded-[24px] border border-amber-200/70 bg-amber-50/80 p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 text-amber-600" size={18} />
                  <div>
                    <div className="text-sm font-semibold text-amber-900">{copy.bannerTitle}</div>
                    <p className="mt-1 text-sm leading-6 text-amber-800">{copy.bannerDescription}</p>
                  </div>
                </div>
              </div>

              <RoleSelector
                selections={customRoleSelections}
                onChange={setCustomRoleSelections}
                validation={customValidation}
                locale={locale}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
