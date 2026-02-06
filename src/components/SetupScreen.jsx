import { User, Brain, AlertTriangle, Key, ExternalLink, Swords, Shield } from 'lucide-react';
import { API_KEY } from '../config/aiConfig';
import { RoleSelector } from './RoleSelector';
import { validateRoleConfig, generateDescription, generateNightSequence, buildRolesArray, DEFAULT_CUSTOM_SELECTIONS, VICTORY_MODES, DEFAULT_VICTORY_MODE } from '../config/roles';

export const SetupScreen = ({
  gameMode,
  setGameMode,
  // 令牌相关属性
  isLoggedIn = false,
  isGuestMode = false,
  hasModelscopeToken = false,
  onConfigureToken = null,
  customRoleSelections = DEFAULT_CUSTOM_SELECTIONS,
  setCustomRoleSelections = () => {},
  onBuildCustomSetup = null,
  // 胜利模式属性
  victoryMode = DEFAULT_VICTORY_MODE,
  setVictoryMode = () => {}
}) => {
  // 需要配置令牌的情况：已登录用户没有配置令牌且环境变量也没有
  const needsTokenConfig = isLoggedIn && !isGuestMode && !hasModelscopeToken;

  // 自定义模式验证
  const customValidation = validateRoleConfig(customRoleSelections);

  // 是否可以开始游戏
  const hasApiAccess = isGuestMode ? !!API_KEY : (hasModelscopeToken || !!API_KEY);
  const canStartGame = hasApiAccess && customValidation.isValid;

  // 处理开始游戏
  const handleStartGame = (mode) => {
    // 自定义（唯一模式）：开局前基于当前选择构建 setup
    if (onBuildCustomSetup) {
      const rolesArray = buildRolesArray(customRoleSelections);
      const customSetup = {
        id: 'custom',
        name: '自定义局',
        TOTAL_PLAYERS: rolesArray.length,
        STANDARD_ROLES: rolesArray,
        NIGHT_SEQUENCE: generateNightSequence(customRoleSelections),
        description: generateDescription(customRoleSelections),
        isCustom: true
      };
      onBuildCustomSetup(customSetup);
    }
    setGameMode(mode);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8">
      <h1 className="text-4xl font-black tracking-tighter">
        WEREWOLF <span className="text-indigo-500">PRO</span>
      </h1>

      {/* 令牌配置提示 - 仅对已登录用户显示 */}
      {needsTokenConfig && !API_KEY && (
        <div className="flex items-center gap-3 px-6 py-4 bg-amber-900/50 border border-amber-600 rounded-xl max-w-lg">
          <Key className="w-6 h-6 text-amber-500 flex-shrink-0" />
          <div className="text-sm flex-1">
            <p className="font-bold text-amber-400">需要配置 ModelScope 令牌</p>
            <p className="text-amber-200/80 mb-2">
              您需要配置 ModelScope API 令牌才能玩 AI 狼人杀。
            </p>
            <div className="flex items-center gap-4">
              {onConfigureToken && (
                <button
                  onClick={onConfigureToken}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  配置令牌
                </button>
              )}
              <a
                href="https://modelscope.cn/my/access/token"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm"
              >
                获取令牌 <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* API Key Warning - 游客模式且环境变量未配置 */}
      {isGuestMode && !API_KEY && (
        <div className="flex items-center gap-3 px-6 py-4 bg-amber-900/50 border border-amber-600 rounded-xl max-w-md">
          <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-bold text-amber-400">API Key 未配置</p>
            <p className="text-amber-200/80">游戏需要 AI 服务。请登录并配置您的 ModelScope 令牌。</p>
          </div>
        </div>
      )}

      {/* 自定义模式说明 */}
      <div className="w-full max-w-2xl px-4">
        <div className="flex items-start gap-3 px-6 py-4 bg-zinc-900/50 border border-zinc-700 rounded-xl">
          <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm flex-1">
            <p className="font-bold text-zinc-200">关于响应速度与稳定性</p>
            <p className="text-zinc-400 mt-1">
              这是一个调用免费算力平台的大模型狼人杀游戏。部分模型会排队或响应较慢，偶尔也可能掉线/超时。
              游戏过程中请耐心等待；如长时间无响应，可稍后重试或重新开始一局。
            </p>
          </div>
        </div>
      </div>

      {/* 自定义角色选择器 */}
      <RoleSelector
        selections={customRoleSelections}
        onChange={setCustomRoleSelections}
        validation={customValidation}
      />

      {/* 胜利模式选择 */}
      <div className="flex flex-col items-center gap-3">
        <h2 className="text-lg text-zinc-400">胜利条件</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setVictoryMode('edge')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all ${
              victoryMode === 'edge'
                ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            <Swords size={18} />
            <div className="text-left">
              <div className="font-bold">{VICTORY_MODES.EDGE.name}</div>
              <div className="text-xs opacity-80">{VICTORY_MODES.EDGE.description}</div>
            </div>
          </button>
          <button
            onClick={() => setVictoryMode('town')}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all ${
              victoryMode === 'town'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            <Shield size={18} />
            <div className="text-left">
              <div className="font-bold">{VICTORY_MODES.TOWN.name}</div>
              <div className="text-xs opacity-80">{VICTORY_MODES.TOWN.description}</div>
            </div>
          </button>
        </div>
      </div>

      <h2 className="text-xl text-zinc-400">请选择开始模式</h2>
      <div className="flex gap-6">
        <button
          onClick={() => handleStartGame('player')}
          disabled={!canStartGame}
          className={`group px-10 py-6 rounded-2xl text-xl font-bold transition-all transform shadow-xl flex flex-col items-center gap-3 ${
            !canStartGame
              ? 'bg-gray-700 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-br from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 hover:scale-105'
          }`}
        >
          <User className="w-10 h-10" />
          <span>玩家模式</span>
          <span className="text-sm text-green-200 font-normal">您将扮演一名玩家</span>
        </button>
        <button
          onClick={() => handleStartGame('ai-only')}
          disabled={!canStartGame}
          className={`group px-10 py-6 rounded-2xl text-xl font-bold transition-all transform shadow-xl flex flex-col items-center gap-3 ${
            !canStartGame
              ? 'bg-gray-700 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 hover:scale-105'
          }`}
        >
          <Brain className="w-10 h-10" />
          <span>全AI模式</span>
          <span className="text-sm text-purple-200 font-normal">观看{customValidation.total}位AI对战</span>
        </button>
      </div>
    </div>
  );
};
