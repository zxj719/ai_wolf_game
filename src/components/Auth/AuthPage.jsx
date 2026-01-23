import React, { useState } from 'react';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

export function AuthPage({ onGuestPlay }) {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="relative">
      {isLogin ? (
        <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
      ) : (
        <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
      )}

      {/* Guest Play Button - Fixed at bottom */}
      {onGuestPlay && (
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
