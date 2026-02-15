import React, { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { getToken } from '../utils/authToken';
import { Key, ExternalLink, Eye, EyeOff, Check, X, AlertCircle, Loader2 } from 'lucide-react';

/**
 * ModelScope 令牌管理组件
 * 用于用户配置和管理他们的 ModelScope API 令牌
 */
export function TokenManager({ onClose, onTokenSaved }) {
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [networkDiagnosing, setNetworkDiagnosing] = useState(false);
  const [networkStatus, setNetworkStatus] = useState(null);
  const [tokenStatus, setTokenStatus] = useState({
    hasToken: false,
    isValid: false,
    verifiedAt: null,
    errorType: null,
    message: ''
  });

  // 检查当前令牌状态
  useEffect(() => {
    checkTokenStatus();
  }, []);

  const checkTokenStatus = async () => {
    setVerifying(true);
    try {
      const authToken = getToken();
      if (!authToken) return;

      const response = await authService.verifyModelscopeToken(authToken);
      if (response.success) {
        setTokenStatus({
          hasToken: response.hasToken,
          isValid: response.isValid,
          verifiedAt: response.tokenVerifiedAt,
          errorType: response.errorType || null,
          message: response.message || ''
        });
      }
    } catch (err) {
      console.error('Check token status error:', err);
    } finally {
      setVerifying(false);
    }
  };

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) {
      setError('请输入 ModelScope 令牌');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const authToken = getToken();
      if (!authToken) {
        setError('请先登录');
        return;
      }

      const response = await authService.saveModelscopeToken(authToken, tokenInput.trim());

      if (response.success) {
        setSuccess('令牌验证通过，保存成功！可以开始游戏了！');
        setTokenInput('');
        setTokenStatus({
          hasToken: true,
          isValid: true,
          verifiedAt: response.tokenVerifiedAt,
          errorType: null,
          message: ''
        });

        // 通知父组件
        if (onTokenSaved) {
          onTokenSaved(tokenInput.trim());
        }
      }
    } catch (err) {
      setError(err.message || '保存令牌失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteToken = async () => {
    if (!window.confirm('确定要删除已保存的令牌吗？删除后将无法继续玩 AI 狼人杀。')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const authToken = getToken();
      if (!authToken) return;

      const response = await authService.deleteModelscopeToken(authToken);

      if (response.success) {
        setSuccess('令牌已删除');
        setTokenStatus({
          hasToken: false,
          isValid: false,
          verifiedAt: null,
          errorType: null,
          message: ''
        });
      }
    } catch (err) {
      setError(err.message || '删除令牌失败');
    } finally {
      setLoading(false);
    }
  };

  // 网络诊断
  const handleNetworkDiagnose = async () => {
    setNetworkDiagnosing(true);
    setNetworkStatus(null);
    setError('');

    try {
      // 测试 ModelScope API 连通性
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

      const response = await fetch('https://api-inference.modelscope.cn/v1/models', {
        method: 'GET',
        mode: 'cors',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setNetworkStatus({
          success: true,
          message: '✅ ModelScope API 可正常访问'
        });
      } else {
        setNetworkStatus({
          success: false,
          message: `⚠️ ModelScope API 返回异常状态: ${response.status}`
        });
      }
    } catch (err) {
      console.error('Network diagnosis error:', err);

      let errorMsg = '❌ 无法访问 ModelScope API';
      let suggestion = '';

      if (err.name === 'AbortError') {
        errorMsg = '❌ 连接 ModelScope API 超时';
        suggestion = '网络延迟过高，请检查网络连接或稍后重试';
      } else if (err.message.includes('CORS') || err.message.includes('Failed to fetch')) {
        errorMsg = '❌ 网络阻止访问 ModelScope API';
        suggestion = '可能原因：VPN 限制、防火墙拦截、企业网络策略。建议：关闭 VPN 或切换网络（如使用手机热点）';
      }

      setNetworkStatus({
        success: false,
        message: errorMsg,
        suggestion
      });
    } finally {
      setNetworkDiagnosing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl max-w-lg w-full p-6 relative border border-zinc-700">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* 标题 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-amber-600/20 rounded-full flex items-center justify-center">
            <Key className="text-amber-500" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">ModelScope 令牌配置</h2>
            <p className="text-sm text-zinc-400">配置您的 API 令牌以使用 AI 狼人杀</p>
          </div>
        </div>

        {/* 当前状态 */}
        <div className="mb-6 p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
          <div className="flex items-center justify-between">
            <span className="text-zinc-300">当前状态</span>
            {verifying ? (
              <span className="flex items-center gap-2 text-zinc-400">
                <Loader2 size={16} className="animate-spin" />
                验证中（测试 AI 调用）...
              </span>
            ) : tokenStatus.hasToken ? (
              tokenStatus.isValid ? (
                <span className="flex items-center gap-2 text-green-400">
                  <Check size={16} />
                  ✓ 已验证，可以开始游戏！
                </span>
              ) : (
                <span className="flex items-center gap-2 text-red-400">
                  <AlertCircle size={16} />
                  {tokenStatus.errorType === 'account_not_verified'
                    ? '需要完成阿里云绑定/实名认证'
                    : tokenStatus.errorType === 'token_invalid'
                    ? '令牌无效或已过期'
                    : tokenStatus.errorType === 'network_error'
                    ? '网络连接失败'
                    : '验证失败'}
                </span>
              )
            ) : (
              <span className="flex items-center gap-2 text-yellow-400">
                <AlertCircle size={16} />
                未配置
              </span>
            )}
          </div>
          {tokenStatus.message && !tokenStatus.isValid && tokenStatus.hasToken && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-red-400">
                {tokenStatus.message}
              </p>
              {tokenStatus.errorType === 'network_error' && (
                <div className="text-xs text-amber-400 bg-amber-900/20 border border-amber-700/30 rounded p-2">
                  <p className="font-medium mb-1">💡 网络问题排查建议：</p>
                  <ul className="list-disc list-inside space-y-1 text-amber-300/90">
                    <li>关闭 VPN（部分 VPN 节点无法访问 ModelScope）</li>
                    <li>切换网络（尝试手机热点或其他 WiFi）</li>
                    <li>检查防火墙设置</li>
                    <li>点击下方"网络诊断"按钮进行详细检测</li>
                  </ul>
                </div>
              )}
            </div>
          )}
          {tokenStatus.verifiedAt && tokenStatus.isValid && (
            <p className="text-xs text-zinc-500 mt-2">
              上次验证: {new Date(tokenStatus.verifiedAt).toLocaleString('zh-CN')}
            </p>
          )}
        </div>

        {/* 获取令牌指引 */}
        <div className="mb-6 p-4 rounded-lg bg-blue-900/20 border border-blue-700/50">
          <h3 className="text-sm font-medium text-blue-300 mb-3">📋 配置步骤（请按顺序完成）</h3>
          <ol className="text-sm text-zinc-300 space-y-3">
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold text-white">1</span>
              <div className="flex-1">
                <span className="font-medium text-white">注册 ModelScope 账户</span>
                <a
                  href="https://modelscope.cn/register?back=%2Fmodels"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors text-xs"
                >
                  前往注册 <ExternalLink size={12} />
                </a>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-amber-600 rounded-full flex items-center justify-center text-xs font-bold text-white">2</span>
              <div className="flex-1">
                <span className="font-medium text-white">绑定阿里云账号</span>
                <span className="text-amber-400 text-xs ml-1">(必需)</span>
                <a
                  href="https://modelscope.cn/docs/accounts/aliyun-binding-and-authorization"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors text-xs"
                >
                  绑定教程 <ExternalLink size={12} />
                </a>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-amber-600 rounded-full flex items-center justify-center text-xs font-bold text-white">3</span>
              <div className="flex-1">
                <span className="font-medium text-white">完成阿里云实名认证</span>
                <span className="text-amber-400 text-xs ml-1">(必需)</span>
                <a
                  href="https://help.aliyun.com/zh/account/account-verification-overview"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors text-xs"
                >
                  认证指南 <ExternalLink size={12} />
                </a>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-xs font-bold text-white">4</span>
              <div className="flex-1">
                <span className="font-medium text-white">获取 Access Token</span>
                <a
                  href="https://modelscope.cn/my/access/token"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors text-xs"
                >
                  获取令牌 <ExternalLink size={12} />
                </a>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-xs font-bold text-white">5</span>
              <div className="flex-1">
                <span className="font-medium text-white">复制并粘贴到下方输入框</span>
              </div>
            </li>
          </ol>
          <div className="mt-3 p-2 rounded bg-amber-900/30 border border-amber-700/50">
            <p className="text-xs text-amber-300">
              ⚠️ <strong>重要提示：</strong>步骤 2-3 必须完成，否则 API 无法正常使用！
            </p>
          </div>
        </div>

        {/* 令牌输入 */}
        <div className="mb-4">
          <label className="block text-sm text-zinc-300 mb-2">
            {tokenStatus.hasToken ? '更新令牌' : '输入令牌'}
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="粘贴您的 ModelScope Access Token"
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 pr-12"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
            >
              {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* 网络诊断结果 */}
        {networkStatus && (
          <div className={`mb-4 p-3 rounded-lg border text-sm ${
            networkStatus.success
              ? 'bg-green-900/30 border-green-700/50 text-green-300'
              : 'bg-red-900/30 border-red-700/50 text-red-300'
          }`}>
            <p className="font-medium">{networkStatus.message}</p>
            {networkStatus.suggestion && (
              <p className="mt-2 text-xs opacity-90">{networkStatus.suggestion}</p>
            )}
          </div>
        )}

        {/* 错误/成功消息 */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-lg bg-green-900/30 border border-green-700/50 text-green-300 text-sm">
            {success}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="space-y-3">
          <div className="flex gap-3">
            <button
              onClick={handleSaveToken}
              disabled={loading || !tokenInput.trim()}
              className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Check size={18} />
                  保存令牌
                </>
              )}
            </button>

            {tokenStatus.hasToken && (
              <button
                onClick={handleDeleteToken}
                disabled={loading}
                className="px-4 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 text-red-400 rounded-lg transition-colors"
              >
                删除
              </button>
            )}
          </div>

          {/* 网络诊断按钮 */}
          <button
            onClick={handleNetworkDiagnose}
            disabled={networkDiagnosing}
            className="w-full py-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/50 text-blue-400 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
          >
            {networkDiagnosing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                诊断中...
              </>
            ) : (
              <>
                <AlertCircle size={16} />
                网络诊断（如验证失败请点击）
              </>
            )}
          </button>
        </div>

        {/* 隐私说明 */}
        <p className="mt-4 text-xs text-zinc-500 text-center">
          您的令牌将安全存储在服务器端，仅用于 AI 狼人杀游戏的 API 调用。
        </p>
      </div>
    </div>
  );
}
