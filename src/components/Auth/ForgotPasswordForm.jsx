import React, { useState } from 'react';
import { authService } from '../../services/authService';
import { Mail, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';

export function ForgotPasswordForm({ onBack }) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('请输入邮箱地址');
      return;
    }

    setIsLoading(true);
    try {
      await authService.forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err.message || '发送失败，请稍后重试');
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
            <h2 className="text-xl font-bold text-zinc-100 mb-2">邮件已发送</h2>
            <p className="text-zinc-400 mb-6">
              如果该邮箱已注册，你将收到一封包含重置密码链接的邮件。
              请检查你的收件箱（包括垃圾邮件文件夹）。
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
            <h1 className="text-2xl font-bold text-zinc-100 mb-2">忘记密码</h1>
            <p className="text-zinc-400">输入你的邮箱，我们将发送重置链接</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                邮箱地址
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                placeholder="your@email.com"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  发送中...
                </>
              ) : (
                <>
                  <Mail size={20} />
                  发送重置链接
                </>
              )}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-300 transition-colors"
            >
              <ArrowLeft size={16} />
              返回登录
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
