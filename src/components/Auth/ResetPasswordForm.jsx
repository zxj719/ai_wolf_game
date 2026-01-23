import React, { useState, useEffect } from 'react';
import { authService } from '../../services/authService';
import { Eye, EyeOff, Lock, Loader2, CheckCircle, XCircle } from 'lucide-react';

export function ResetPasswordForm({ token, onSuccess, onBack }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // 密码验证状态
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false
  });

  useEffect(() => {
    setPasswordChecks({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password)
    });
  }, [password]);

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isPasswordValid) {
      setError('请确保密码满足所有要求');
      return;
    }

    if (!passwordsMatch) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsLoading(true);
    try {
      await authService.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err.message || '重置密码失败');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
        <div className="w-full max-w-md">
          <div className="bg-zinc-900 rounded-2xl shadow-xl border border-zinc-800 p-8 text-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-zinc-100 mb-2">密码重置成功</h2>
            <p className="text-zinc-400 mb-6">
              你的密码已成功重置，现在可以使用新密码登录了。
            </p>
            <button
              onClick={onSuccess || onBack}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              去登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
        <div className="w-full max-w-md">
          <div className="bg-zinc-900 rounded-2xl shadow-xl border border-zinc-800 p-8 text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle size={32} className="text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-zinc-100 mb-2">无效的链接</h2>
            <p className="text-zinc-400 mb-6">
              重置密码链接无效或已过期，请重新请求。
            </p>
            <button
              onClick={onBack}
              className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              返回登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md">
        <div className="bg-zinc-900 rounded-2xl shadow-xl border border-zinc-800 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-zinc-100 mb-2">设置新密码</h1>
            <p className="text-zinc-400">请输入你的新密码</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                新密码
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors pr-12"
                  placeholder="输入新密码"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {/* Password Requirements */}
              <div className="mt-3 space-y-1">
                {[
                  { key: 'length', text: '至少8个字符' },
                  { key: 'uppercase', text: '包含大写字母' },
                  { key: 'lowercase', text: '包含小写字母' },
                  { key: 'number', text: '包含数字' }
                ].map(({ key, text }) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    {passwordChecks[key] ? (
                      <CheckCircle size={14} className="text-green-400" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-zinc-600" />
                    )}
                    <span className={passwordChecks[key] ? 'text-green-400' : 'text-zinc-500'}>
                      {text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                确认密码
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="再次输入新密码"
                disabled={isLoading}
              />
              {confirmPassword && !passwordsMatch && (
                <p className="mt-2 text-xs text-red-400">密码不一致</p>
              )}
              {passwordsMatch && (
                <p className="mt-2 text-xs text-green-400">密码一致</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !isPasswordValid || !passwordsMatch}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  重置中...
                </>
              ) : (
                <>
                  <Lock size={20} />
                  重置密码
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
