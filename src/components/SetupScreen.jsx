import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  ExternalLink,
  History,
  Key,
  Play,
  PlusCircle,
  Shield,
  Swords,
  User,
} from 'lucide-react';
import { API_KEY, WEREWOLF_AI_MODE } from '../config/aiConfig';
import { RoleSelector } from './RoleSelector';
import {
  validateRoleConfig,
  generateNightSequence,
  buildRolesArray,
  DEFAULT_CUSTOM_SELECTIONS,
  DEFAULT_VICTORY_MODE,
} from '../config/roles';
import { getUiCopy, getVictoryModeCopy } from '../i18n/locale.js';

function ActionCard({ icon: Icon, title, description, onClick, disabled, selected = false }) {
  const toneClass = selected
    ? 'border-accent bg-accent text-white shadow-sm'
    : 'border-line bg-bg-raised text-ink';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`w-full rounded-[20px] border px-4 py-4 text-left transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
    >
      <div className="flex items-start gap-3">
        <span className={`mac-icon-tile h-10 w-10 rounded-[16px] ${selected ? '!bg-white/12 !text-white !border-white/10' : ''}`}>
          <Icon size={18} />
        </span>
        <div>
          <div className={`text-sm font-semibold ${selected ? 'text-white' : 'text-ink'}`}>{title}</div>
          <div className={`mt-1 text-sm leading-6 ${selected ? 'text-white/72' : 'text-ink-muted'}`}>{description}</div>
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
  isAdmin = false,
  hasModelscopeToken = false,
  onConfigureToken = null,
  customRoleSelections = DEFAULT_CUSTOM_SELECTIONS,
  setCustomRoleSelections = () => {},
  onBuildCustomSetup = null,
  victoryMode = DEFAULT_VICTORY_MODE,
  setVictoryMode = () => {},
  enableSheriff = true,
  setEnableSheriff = () => {},
  speakingOrder = 'left',
  setSpeakingOrder = () => {},
  onExit = null,
  exitLabel,
  locale = 'zh',
  pendingSnapshot = null,
  onResumeSnapshot = null,
  onDiscardSnapshot = null,
  onStartNewGame = null,
}) {
  const copy = getUiCopy(locale).setup;
  // Guest（非 admin）自动锁定全 AI 模式
  const guestOnlyAI = !isAdmin && (isGuestMode || !isLoggedIn);
  const [selectedMode, setSelectedMode] = useState(() => guestOnlyAI ? 'ai-only' : (gameMode || null));

  const usesServerSessionAI = WEREWOLF_AI_MODE === 'session' || WEREWOLF_AI_MODE === 'claude-session';
  // Guest 不需要 ModelScope token（系统使用内置 API）
  const needsTokenConfig = false;
  const customValidation = validateRoleConfig(customRoleSelections);
  const hasApiAccess = usesServerSessionAI || (isGuestMode ? !!API_KEY : hasModelscopeToken || !!API_KEY);
  const canStartSelectedMode = !!selectedMode && customValidation.isValid;

  const edgeCopy = getVictoryModeCopy('edge', locale);
  const townCopy = getVictoryModeCopy('town', locale);
  const selectionLabel = copy.selectionLabel || (locale === 'en' ? 'Selected Mode' : '已选模式');
  const selectionEmpty = copy.selectionEmpty || (locale === 'en' ? 'Select Player Mode or All-AI Mode first' : '请先选择玩家模式或全 AI 模式');
  const startButtonLabel = copy.startButton || (locale === 'en' ? 'Start Game' : '开始游戏');
  const resumeCopy = locale === 'en'
    ? { title: 'Unfinished match', day: 'Day', continue: 'Continue', fresh: 'New match' }
    : { title: '未完成对局', day: '第', continue: '继续', fresh: '新开一局' };
  const selectedModeLabel = selectedMode === 'player'
    ? copy.playerMode
    : selectedMode === 'ai-only'
      ? copy.aiMode
      : null;

  const startHelperText = (() => {
    if (!selectedMode) {
      return selectionEmpty;
    }
    if (!customValidation.isValid) {
      return customValidation.errors[0] || copy.chooseRole;
    }
    if (!hasApiAccess) {
      return isGuestMode ? copy.guestTokenDescription : copy.tokenDescription;
    }
    if (typeof copy.startReady === 'function') {
      return copy.startReady(selectedModeLabel);
    }
    return locale === 'en' ? `Ready to start in ${selectedModeLabel}` : `当前将以“${selectedModeLabel}”开始`;
  })();

  const handleStartGame = () => {
    if (!selectedMode || !customValidation.isValid) {
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
    onStartNewGame?.();
    setGameMode(selectedMode);
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
                <h2 className="text-3xl font-semibold tracking-tight text-ink">{copy.chooseMode}</h2>
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

              {isGuestMode && !usesServerSessionAI && !API_KEY && (
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

              {pendingSnapshot && (
                <div className="mac-panel p-4">
                  <div className="flex items-start gap-3">
                    <span className="mac-icon-tile h-10 w-10 rounded-[16px]">
                      <History size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-ink">{resumeCopy.title}</div>
                      <div className="mt-1 text-sm leading-6 text-ink-muted">
                        {locale === 'en'
                          ? `${resumeCopy.day} ${pendingSnapshot.state?.dayCount || 1} · ${pendingSnapshot.state?.phase || 'setup'}`
                          : `${resumeCopy.day}${pendingSnapshot.state?.dayCount || 1}天 · ${pendingSnapshot.state?.phase || 'setup'}`}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={onResumeSnapshot} className="mac-button mac-button-primary">
                          <Play size={15} />
                          {resumeCopy.continue}
                        </button>
                        <button type="button" onClick={onDiscardSnapshot} className="mac-button mac-button-secondary">
                          <PlusCircle size={15} />
                          {resumeCopy.fresh}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <ActionCard
                  icon={User}
                  title={copy.playerMode}
                  description={copy.playerModeDescription}
                  onClick={() => setSelectedMode('player')}
                  disabled={!customValidation.isValid}
                  selected={selectedMode === 'player'}
                />
                <ActionCard
                  icon={Brain}
                  title={copy.aiMode}
                  description={copy.aiModeDescription(customValidation.total)}
                  onClick={() => setSelectedMode('ai-only')}
                  disabled={!customValidation.isValid}
                  selected={selectedMode === 'ai-only'}
                />
              </div>

              <div className="mac-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="mac-eyebrow">{selectionLabel}</div>
                    <div className="mt-1 text-base font-semibold text-ink">
                      {selectedModeLabel || selectionEmpty}
                    </div>
                  </div>
                  {selectedModeLabel && <div className="mac-badge">{selectedModeLabel}</div>}
                </div>
                <p className="mt-3 text-sm leading-6 text-ink-muted">{startHelperText}</p>
                <button
                  type="button"
                  onClick={handleStartGame}
                  disabled={!canStartSelectedMode}
                  className={`mac-button mt-4 w-full justify-center ${canStartSelectedMode ? 'mac-button-primary' : 'mac-button-secondary'}`}
                >
                  {startButtonLabel}
                </button>
              </div>

              <div className="mac-panel p-4">
                <div className="mac-eyebrow">{copy.victoryRule}</div>
                <div className="mt-3 space-y-3">
                  <button
                    type="button"
                    onClick={() => setVictoryMode('edge')}
                    className={`w-full rounded-[18px] border px-4 py-3 text-left transition-colors ${
                      victoryMode === 'edge'
                        ? 'border-accent bg-accent text-white'
                        : 'border-line bg-bg-raised text-ink'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mac-icon-tile h-9 w-9 rounded-[14px] ${victoryMode === 'edge' ? '!bg-white/12 !text-white !border-white/10' : ''}`}>
                        <Swords size={16} />
                      </span>
                      <div>
                        <div className={`text-sm font-semibold ${victoryMode === 'edge' ? 'text-white' : 'text-ink'}`}>{edgeCopy.name}</div>
                        <div className={`mt-1 text-sm ${victoryMode === 'edge' ? 'text-white/72' : 'text-ink-muted'}`}>{edgeCopy.description}</div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setVictoryMode('town')}
                    className={`w-full rounded-[18px] border px-4 py-3 text-left transition-colors ${
                      victoryMode === 'town'
                        ? 'border-accent bg-accent text-white'
                        : 'border-line bg-bg-raised text-ink'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mac-icon-tile h-9 w-9 rounded-[14px] ${victoryMode === 'town' ? '!bg-white/12 !text-white !border-white/10' : ''}`}>
                        <Shield size={16} />
                      </span>
                      <div>
                        <div className={`text-sm font-semibold ${victoryMode === 'town' ? 'text-white' : 'text-ink'}`}>{townCopy.name}</div>
                        <div className={`mt-1 text-sm ${victoryMode === 'town' ? 'text-white/72' : 'text-ink-muted'}`}>{townCopy.description}</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="mac-panel p-4">
                <div className="mac-eyebrow">警长机制</div>
                <button
                  type="button"
                  onClick={() => setEnableSheriff(!enableSheriff)}
                  aria-pressed={enableSheriff}
                  className={`mt-3 w-full rounded-[18px] border px-4 py-3 text-left transition-colors ${
                    enableSheriff
                      ? 'border-accent bg-accent text-white'
                      : 'border-line bg-bg-raised text-ink'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`mac-icon-tile h-9 w-9 rounded-[14px] ${enableSheriff ? '!bg-white/12 !text-white !border-white/10' : ''}`}>
                      <Shield size={16} />
                    </span>
                    <div>
                      <div className={`text-sm font-semibold ${enableSheriff ? 'text-white' : 'text-ink'}`}>
                        警长竞选 {enableSheriff ? '已启用' : '已关闭'}
                      </div>
                      <div className={`mt-1 text-sm ${enableSheriff ? 'text-white/72' : 'text-ink-muted'}`}>
                        第1天上警竞选，警长投票权重1.5票，死亡时可移交警徽
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              <div className="mac-panel p-4">
                <div className="mac-eyebrow">{locale === 'en' ? 'Speaking Order' : '发言顺序'}</div>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSpeakingOrder('left')}
                    className={`flex-1 rounded-[18px] border px-4 py-3 text-center transition-colors ${
                      speakingOrder === 'left'
                        ? 'border-accent bg-accent text-white'
                        : 'border-line bg-bg-raised text-ink'
                    }`}
                  >
                    <div className="text-lg">↻</div>
                    <div className="text-sm font-semibold">{locale === 'en' ? 'Clockwise' : '顺时针'}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpeakingOrder('right')}
                    className={`flex-1 rounded-[18px] border px-4 py-3 text-center transition-colors ${
                      speakingOrder === 'right'
                        ? 'border-accent bg-accent text-white'
                        : 'border-line bg-bg-raised text-ink'
                    }`}
                  >
                    <div className="text-lg">↺</div>
                    <div className="text-sm font-semibold">{locale === 'en' ? 'Counter-clockwise' : '逆时针'}</div>
                  </button>
                </div>
              </div>
            </aside>

            <section className="space-y-4">
              <div className="mac-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="mac-eyebrow">{copy.configSummary}</div>
                    <div className="mt-1 text-base font-semibold text-ink">{copy.buildSummary(customValidation.description)}</div>
                  </div>
                  <div className="mac-badge">
                    {copy.totalPlayers}: <span className="font-semibold text-ink">{customValidation.total}</span>
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
