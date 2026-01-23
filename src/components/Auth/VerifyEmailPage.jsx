import React, { useState, useEffect } from 'react';
import { authService } from '../../services/authService';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export function VerifyEmailPage({ token, onSuccess, onBack }) {
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) {
      verifyEmail();
    } else {
      setStatus('error');
      setError('无效的验证链接');
    }
  }, [token]);

  const verifyEmail = async () => {
    try {
      await authService.verifyEmail(token);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err.message || '验证失败');
    }
  };

  if (status === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
        <div className="w-full max-w-md">
          <div className="bg-zinc-900 rounded-2xl shadow-xl border border-zinc-800 p-8 text-center">
            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 size={32} className="text-blue-400 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-zinc-100 mb-2">正在验证邮箱...</h2>
            <p className="text-zinc-400">请稍候</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
        <div className="w-full max-w-md">
          <div className="bg-zinc-900 rounded-2xl shadow-xl border border-zinc-800 p-8 text-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-zinc-100 mb-2">邮箱验证成功</h2>
            <p className="text-zinc-400 mb-6">
              你的邮箱已成功验证，现在可以使用完整功能了。
            </p>
            <button
              onClick={onSuccess || onBack}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              继续
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md">
        <div className="bg-zinc-900 rounded-2xl shadow-xl border border-zinc-800 p-8 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle size={32} className="text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-zinc-100 mb-2">验证失败</h2>
          <p className="text-zinc-400 mb-6">
            {error || '验证链接无效或已过期，请重新发送验证邮件。'}
          </p>
          <button
            onClick={onBack}
            className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            返回
          </button>
        </div>
      </div>
    </div>
  );
}
