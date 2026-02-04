import React from 'react';
import { User, Brain, AlertTriangle, Key, ExternalLink } from 'lucide-react';
import { API_KEY } from '../config/aiConfig';

export const SetupScreen = ({
  gameMode,
  setGameMode,
  selectedSetup,
  setSelectedSetup,
  gameSetups,
  // 新增：令牌相关属性
  isLoggedIn = false,
  isGuestMode = false,
  hasModelscopeToken = false,
  onConfigureToken = null
}) => {
  // 需要配置令牌的情况：已登录用户没有配置令牌且环境变量也没有
  const needsTokenConfig = isLoggedIn && !isGuestMode && !hasModelscopeToken;

  // 是否可以开始游戏：游客可以直接玩（使用环境变量），登录用户必须配置令牌
  const canStartGame = isGuestMode ? !!API_KEY : (hasModelscopeToken || !!API_KEY);

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

      {/* Setup Selection */}
      <div className="flex gap-4 p-2 bg-zinc-900/50 rounded-xl">
         {gameSetups.map(setup => (
           <button
             key={setup.id}
             onClick={() => setSelectedSetup(setup)}
             className={`px-6 py-3 rounded-lg font-bold transition-all ${
                selectedSetup.id === setup.id 
                ? 'bg-indigo-600 text-white shadow-lg' 
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
             }`}
           >
             <div className="text-lg">{setup.name}</div>
             <div className="text-xs opacity-70 font-normal">{setup.description}</div>
           </button>
         ))}
      </div>

      <h2 className="text-xl text-zinc-400">请选择开始模式</h2>
      <div className="flex gap-6">
        <button
          onClick={() => setGameMode('player')}
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
          onClick={() => setGameMode('ai-only')}
          disabled={!canStartGame}
          className={`group px-10 py-6 rounded-2xl text-xl font-bold transition-all transform shadow-xl flex flex-col items-center gap-3 ${
            !canStartGame
              ? 'bg-gray-700 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-br from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 hover:scale-105'
          }`}
        >
          <Brain className="w-10 h-10" />
          <span>全AI模式</span>
          <span className="text-sm text-purple-200 font-normal">观看{selectedSetup.TOTAL_PLAYERS}位AI对战</span>
        </button>
      </div>
    </div>
  );
};
