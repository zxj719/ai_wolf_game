import React, { useState, useEffect } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { ResetPasswordForm } from './ResetPasswordForm';
import { VerifyEmailPage } from './VerifyEmailPage';

export function AuthPage({ onGuestPlay }) {
  // 'login' | 'register' | 'forgot' | 'reset' | 'verify'
  const [view, setView] = useState('login');
  const [resetToken, setResetToken] = useState(null);
  const [verifyToken, setVerifyToken] = useState(null);

  // 检查URL参数
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;

    // 检查是否是重置密码页面
    if (path === '/reset-password' || params.get('reset')) {
      const token = params.get('token');
      if (token) {
        setResetToken(token);
        setView('reset');
      }
    }

    // 检查是否是邮箱验证页面
    if (path === '/verify-email' || params.get('verify')) {
      const token = params.get('token');
      if (token) {
        setVerifyToken(token);
        setView('verify');
      }
    }
  }, []);

  const handleBackToLogin = () => {
    // 清除URL参数
    window.history.replaceState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
    setView('login');
    setResetToken(null);
    setVerifyToken(null);
  };

  const renderView = () => {
    switch (view) {
      case 'register':
        return <RegisterForm onSwitchToLogin={() => setView('login')} />;
      case 'forgot':
        return <ForgotPasswordForm onBack={handleBackToLogin} />;
      case 'reset':
        return (
          <ResetPasswordForm
            token={resetToken}
            onSuccess={handleBackToLogin}
            onBack={handleBackToLogin}
          />
        );
      case 'verify':
        return (
          <VerifyEmailPage
            token={verifyToken}
            onSuccess={handleBackToLogin}
            onBack={handleBackToLogin}
          />
        );
      default:
        return (
          <LoginForm
            onSwitchToRegister={() => setView('register')}
            onForgotPassword={() => setView('forgot')}
          />
        );
    }
  };

  return (
    <div className="relative">
      {renderView()}

      {/* Guest Play Button - Fixed at bottom (only show on login/register) */}
      {onGuestPlay && (view === 'login' || view === 'register') && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
          <button
            onClick={onGuestPlay}
            className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg border border-zinc-700 transition-colors"
          >
            游客模式体验
          </button>
        </div>
      )}
    </div>
  );
}
