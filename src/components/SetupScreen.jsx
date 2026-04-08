import React from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  ExternalLink,
  Key,
  Shield,
  Swords,
  User,
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

function ActionCard({ icon: Icon, title, description, onClick, disabled, tone = 'default' }) {
  const toneClass = tone === 'primary'
    ? 'border-slate-900/10 bg-slate-900 text-white'
    : 'border-slate-200 bg-white/78 text-slate-900';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-[20px] border px-4 py-4 text-left transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
    >
      <div className="flex items-start gap-3">
        <span className={`mac-icon-tile h-10 w-10 rounded-[16px] ${tone === 'primary' ? '!bg-white/12 !text-white !border-white/10' : ''}`}>
          <Icon size={18} />
        </span>
        <div>
          <div className={`text-sm font-semibold ${tone === 'primary' ? 'text-white' : 'text-slate-900'}`}>{title}</div>
          <div className={`mt-1 text-sm leading-6 ${tone === 'primary' ? 'text-white/72' : 'text-slate-500'}`}>{description}</div>
        </div>
      </div>
    </button>
  );
}

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

  const needsTokenConfig = isLoggedIn && !isGuestMode && !hasModelscopeToken;
  const customValidation = validateRoleConfig(customRoleSelections);
  const hasApiAccess = isGuestMode ? !!API_KEY : hasModelscopeToken || !!API_KEY;

  const edgeCopy = getVictoryModeCopy('edge', locale);
  const townCopy = getVictoryModeCopy('town', locale);

  const handleStartGame = (mode) => {
    if (!customValidation.isValid) {
      return;
    }

    if (!hasApiAccess) {
      onConfigureToken?.();
      return;
    }

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
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-6xl">
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

          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[320px_1fr] lg:px-8">
            <aside className="space-y-4">
              <div className="space-y-3">
                <div className="mac-eyebrow">{copy.subtitle}</div>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950">{copy.chooseMode}</h2>
                <p className="mac-section-copy">{copy.bannerDescription}</p>
              </div>

              {needsTokenConfig && !API_KEY && (
                <div className="rounded-[20px] border border-amber-200/80 bg-amber-50/82 p-4 text-sm leading-6 text-amber-800">
                  <div className="flex items-start gap-3">
                    <Key size={18} className="mt-1 shrink-0" />
                    <div className="space-y-3">
                      <div>
                        <div className="font-semibold">{copy.tokenTitle}</div>
                        <div>{copy.tokenDescription}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
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
                <div className="rounded-[20px] border border-amber-200/80 bg-amber-50/82 p-4 text-sm leading-6 text-amber-800">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="mt-1 shrink-0" />
                    <div>
                      <div className="font-semibold">{copy.guestTokenTitle}</div>
                      <div>{copy.guestTokenDescription}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <ActionCard
                  icon={User}
                  title={copy.playerMode}
                  description={copy.playerModeDescription}
                  onClick={() => handleStartGame('player')}
                  disabled={!customValidation.isValid}
                  tone="primary"
                />
                <ActionCard
                  icon={Brain}
                  title={copy.aiMode}
                  description={copy.aiModeDescription(customValidation.total)}
                  onClick={() => handleStartGame('ai-only')}
                  disabled={!customValidation.isValid}
                />
              </div>

              <div className="mac-panel p-4">
                <div className="mac-eyebrow">{copy.victoryRule}</div>
                <div className="mt-3 space-y-3">
                  <button
                    type="button"
                    onClick={() => setVictoryMode('edge')}
                    className={`w-full rounded-[18px] border px-4 py-3 text-left transition-colors ${
                      victoryMode === 'edge'
                        ? 'border-slate-900/12 bg-slate-900 text-white'
                        : 'border-slate-200/80 bg-white/78 text-slate-900'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mac-icon-tile h-9 w-9 rounded-[14px] ${victoryMode === 'edge' ? '!bg-white/12 !text-white !border-white/10' : ''}`}>
                        <Swords size={16} />
                      </span>
                      <div>
                        <div className={`text-sm font-semibold ${victoryMode === 'edge' ? 'text-white' : 'text-slate-900'}`}>{edgeCopy.name}</div>
                        <div className={`mt-1 text-sm ${victoryMode === 'edge' ? 'text-white/72' : 'text-slate-500'}`}>{edgeCopy.description}</div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVictoryMode('town')}
                    className={`w-full rounded-[18px] border px-4 py-3 text-left transition-colors ${
                      victoryMode === 'town'
                        ? 'border-slate-900/12 bg-slate-900 text-white'
                        : 'border-slate-200/80 bg-white/78 text-slate-900'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mac-icon-tile h-9 w-9 rounded-[14px] ${victoryMode === 'town' ? '!bg-white/12 !text-white !border-white/10' : ''}`}>
                        <Shield size={16} />
                      </span>
                      <div>
                        <div className={`text-sm font-semibold ${victoryMode === 'town' ? 'text-white' : 'text-slate-900'}`}>{townCopy.name}</div>
                        <div className={`mt-1 text-sm ${victoryMode === 'town' ? 'text-white/72' : 'text-slate-500'}`}>{townCopy.description}</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </aside>

            <section className="space-y-4">
              <div className="mac-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="mac-eyebrow">{copy.configSummary}</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">{copy.buildSummary(customValidation.description)}</div>
                  </div>
                  <div className="mac-badge">
                    {copy.totalPlayers}: <span className="font-semibold text-slate-900">{customValidation.total}</span>
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
