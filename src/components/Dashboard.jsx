import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';
import { TokenManager } from './TokenManager';
import { UserStats } from './UserStats';
import { ModelLeaderboard } from './ModelLeaderboard';
import {
  Gamepad2,
  Settings,
  LogOut,
  Trophy,
  Key,
  ChevronRight,
  AlertCircle,
  Check,
  User,
  ExternalLink,
  Globe,
  LogIn,
  MessageSquare,
  Send
} from 'lucide-react';

/**
 * 用户个人主页/仪表盘
 * 登录后的主界面，提供进入狼人杀和站点入口
 */
const FEEDBACK_MAX_LENGTH = 1000;

export function Dashboard({
  onEnterWolfgame,
  onEnterSites,
  onLogout,
  isGuestMode = false,
  onLogin
}) {
  const { user, tokenStatus, verifyModelscopeToken } = useAuth();
  const [showTokenManager, setShowTokenManager] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackContact, setFeedbackContact] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // 是否可进入游戏（游客模式直接可玩）
  const canPlayGame = isGuestMode ? true : (tokenStatus.hasToken && tokenStatus.isValid);

  const handleEnterGame = () => {
    if (!canPlayGame && !isGuestMode) {
      setShowTokenManager(true);
      return;
    }
    onEnterWolfgame?.();
  };

  const feedbackTrimmedLength = feedbackMessage.trim().length;
  const feedbackLength = feedbackMessage.length;
  const isFeedbackValid = feedbackTrimmedLength >= 5 && feedbackTrimmedLength <= FEEDBACK_MAX_LENGTH;

  const handleSubmitFeedback = async (event) => {
    event.preventDefault();
    setFeedbackStatus(null);

    if (!isFeedbackValid || feedbackLoading) {
      setFeedbackStatus({
        type: 'error',
        text: `请输入至少 5 个字，最多 ${FEEDBACK_MAX_LENGTH} 个字。`
      });
      return;
    }

    setFeedbackLoading(true);
    try {
      const response = await authService.submitFeedback({
        message: feedbackMessage.trim(),
        contact: feedbackContact.trim(),
        username: isGuestMode ? '访客' : (user?.username || '未知'),
        isGuest: isGuestMode,
        page: 'home'
      });

      if (response.success) {
        setFeedbackMessage('');
        setFeedbackStatus({ type: 'success', text: '已发送，感谢你的反馈！' });
      } else {
        setFeedbackStatus({ type: 'error', text: response.error || '发送失败，请稍后再试。' });
      }
    } catch (error) {
      setFeedbackStatus({ type: 'error', text: error.message || '发送失败，请稍后再试。' });
    } finally {
      setFeedbackLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* 顶部导航栏 */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
              <User size={18} className="text-white" />
            </div>
            <div>
              <span className="text-zinc-300 text-sm">
                {isGuestMode ? '游客模式' : '欢迎回来，'}
              </span>
              <span className="text-white font-medium ml-1">
                {isGuestMode ? '访客' : user?.username}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isGuestMode ? (
              <>
                <button
                  onClick={() => setShowStats(true)}
                  className="p-2 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded-lg transition-colors"
                  title="查看战绩"
                >
                  <Trophy size={20} />
                </button>
                <button
                  onClick={() => setShowTokenManager(true)}
                  className={`p-2 rounded-lg transition-colors ${
                    tokenStatus.hasToken
                      ? 'text-green-400 hover:bg-green-900/30'
                      : 'text-yellow-400 hover:bg-yellow-900/30'
                  }`}
                  title="管理令牌"
                >
                  <Key size={20} />
                </button>
                <button
                  onClick={onLogout}
                  className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                  title="登出"
                >
                  <LogOut size={20} />
                </button>
              </>
            ) : (
              <button
                onClick={onLogin}
                className="p-2 text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 rounded-lg transition-colors"
                title="登录"
              >
                <LogIn size={20} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* 欢迎区域 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">我的空间</h1>
          <p className="text-zinc-400">选择你想进入的内容</p>
        </div>

        {/* 功能卡片网格 */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* AI 狼人杀入口 */}
          <div className="group relative bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-2xl overflow-hidden hover:border-amber-600/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Gamepad2 size={28} className="text-white" />
                </div>
                {canPlayGame ? (
                  <span className="px-3 py-1 bg-green-600/20 border border-green-600/50 text-green-400 text-xs rounded-full flex items-center gap-1">
                    <Check size={12} />
                    准备就绪
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-yellow-600/20 border border-yellow-600/50 text-yellow-400 text-xs rounded-full flex items-center gap-1">
                    <AlertCircle size={12} />
                    需要令牌
                  </span>
                )}
              </div>

              <h2 className="text-xl font-bold text-white mb-2">AI 狼人杀</h2>
              <p className="text-zinc-400 text-sm mb-4 leading-relaxed">
                与 AI 玩家一起体验经典狼人杀游戏。支持多种游戏模式，包含纯 AI 对战与人机混合。
              </p>

              {!canPlayGame && !isGuestMode && (
                <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                  <p className="text-yellow-300 text-xs">
                    需要配置 ModelScope API 令牌才能开始游戏。
                    <button
                      onClick={() => setShowTokenManager(true)}
                      className="ml-1 underline hover:text-yellow-200"
                    >
                      立即配置
                    </button>
                  </p>
                </div>
              )}

              <button
                onClick={handleEnterGame}
                disabled={!canPlayGame}
                className={`w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                  canPlayGame
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30'
                    : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                }`}
              >
                {canPlayGame ? '进入游戏' : '需要配置令牌'}
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* 站点入口 */}
          <div className="group relative bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 rounded-2xl overflow-hidden hover:border-blue-600/50 transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Globe size={28} className="text-white" />
                </div>
                <span className="px-3 py-1 bg-blue-600/20 border border-blue-600/50 text-blue-400 text-xs rounded-full">
                  站点集合
                </span>
              </div>

              <h2 className="text-xl font-bold text-white mb-2">站点入口</h2>
              <p className="text-zinc-400 text-sm mb-4 leading-relaxed">
                汇总你的内容入口与外部站点，便于统一跳转与管理。
              </p>

              <button
                onClick={onEnterSites}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/30"
              >
                进入站点
                <ExternalLink size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* AI 模型排行榜 */}
        <div className="mt-8">
          <ModelLeaderboard />
        </div>

        {/* 意见箱 */}
        <div className="mt-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <MessageSquare size={20} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">意见箱</h3>
                <p className="text-zinc-400 text-sm">欢迎反馈问题、建议或新想法</p>
              </div>
            </div>

            <form onSubmit={handleSubmitFeedback} className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs text-zinc-400">反馈内容</label>
                <textarea
                  className="mt-2 w-full min-h-[140px] bg-zinc-950/70 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50"
                  placeholder="说说你的体验、建议或遇到的问题..."
                  value={feedbackMessage}
                  onChange={(event) => setFeedbackMessage(event.target.value)}
                  maxLength={FEEDBACK_MAX_LENGTH}
                />
                <div className="flex items-center justify-between text-xs text-zinc-500 mt-2">
                  <span>{feedbackLength}/{FEEDBACK_MAX_LENGTH}</span>
                  <span>请勿提交敏感信息</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-zinc-400">联系方式（可选）</label>
                  <input
                    type="text"
                    className="mt-2 w-full bg-zinc-950/70 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/50"
                    placeholder="邮箱 / QQ / 微信"
                    value={feedbackContact}
                    onChange={(event) => setFeedbackContact(event.target.value)}
                  />
                </div>

                <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl text-xs text-zinc-400">
                  当前身份：<span className="text-zinc-200">{isGuestMode ? '游客' : (user?.username || '未知')}</span>
                </div>

                <button
                  type="submit"
                  disabled={!isFeedbackValid || feedbackLoading}
                  className={`w-full py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                    isFeedbackValid && !feedbackLoading
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  {feedbackLoading ? '发送中...' : '发送反馈'}
                  <Send size={16} />
                </button>

                {feedbackStatus && (
                  <div className={`text-xs ${feedbackStatus.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                    {feedbackStatus.text}
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
        {/* 更多功能 */}
        <div className="mt-8">
          <h3 className="text-lg font-medium text-zinc-300 mb-4">更多功能</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {!isGuestMode ? (
              <>
                <button
                  onClick={() => setShowStats(true)}
                  className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors text-left"
                >
                  <Trophy size={24} className="text-amber-400 mb-2" />
                  <p className="text-white text-sm font-medium">我的战绩</p>
                  <p className="text-zinc-500 text-xs">查看游戏统计</p>
                </button>

                <button
                  onClick={() => setShowTokenManager(true)}
                  className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors text-left"
                >
                  <Settings size={24} className="text-zinc-400 mb-2" />
                  <p className="text-white text-sm font-medium">令牌管理</p>
                  <p className="text-zinc-500 text-xs">配置 API 令牌</p>
                </button>
              </>
            ) : (
              <>
                <div className="p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-xl text-left">
                  <div className="w-6 h-6 bg-zinc-700 rounded mb-2" />
                  <p className="text-zinc-300 text-sm font-medium">游客模式</p>
                  <p className="text-zinc-500 text-xs">无需令牌即可体验</p>
                </div>
                <div className="p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-xl text-left">
                  <div className="w-6 h-6 bg-zinc-700 rounded mb-2" />
                  <p className="text-zinc-300 text-sm font-medium">登录解锁更多</p>
                  <p className="text-zinc-500 text-xs">保存战绩与令牌</p>
                </div>
              </>
            )}

            <div className="p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-xl text-left opacity-50">
              <div className="w-6 h-6 bg-zinc-700 rounded mb-2" />
              <p className="text-zinc-500 text-sm font-medium">敬请期待</p>
              <p className="text-zinc-600 text-xs">更多内容开发中</p>
            </div>

            <div className="p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-xl text-left opacity-50">
              <div className="w-6 h-6 bg-zinc-700 rounded mb-2" />
              <p className="text-zinc-500 text-sm font-medium">敬请期待</p>
              <p className="text-zinc-600 text-xs">更多内容开发中</p>
            </div>
          </div>
        </div>
      </main>

      {/* 用户战绩弹窗 */}
      {showStats && <UserStats onClose={() => setShowStats(false)} />}

      {/* 令牌管理弹窗 */}
      {showTokenManager && (
        <TokenManager
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
