import React, { useState } from 'react';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getUiCopy } from '../../i18n/locale.js';
import { AuthShell } from './AuthShell.jsx';

export function LoginForm({ onSwitchToRegister, onForgotPassword, locale = 'zh' }) {
  const { login, error } = useAuth();
  const authCopy = getUiCopy(locale).auth;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError('');

    if (!email || !password) {
      setLocalError(authCopy.fillEmailPassword);
      return;
    }

    setIsLoading(true);
    try {
      const result = await login(email, password);
      if (!result.success) {
        setLocalError(result.error || authCopy.loginFailed);
      }
    } catch (err) {
      setLocalError(err.message || authCopy.loginFailed);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell locale={locale} title={authCopy.loginTitle} subtitle={authCopy.guestDescription}>
      {(localError || error) && (
        <div className="mb-6 rounded-[22px] border border-rose-200 bg-rose-50/90 p-4 text-sm text-rose-600">
          {localError || error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{authCopy.email}</span>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mac-input"
            placeholder={authCopy.emailPlaceholder}
            disabled={isLoading}
            autoComplete="email"
          />
        </label>

        <label className="block">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{authCopy.password}</span>
            {onForgotPassword && (
              <button type="button" onClick={onForgotPassword} className="text-sm font-medium text-sky-600 hover:text-sky-500">
                {authCopy.forgotPassword}
              </button>
            )}
          </div>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mac-input pr-12"
              placeholder={authCopy.passwordPlaceholder}
              disabled={isLoading}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? authCopy.hidePassword : authCopy.showPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        <button type="submit" disabled={isLoading} className="mac-button mac-button-primary w-full justify-center py-3">
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {authCopy.loggingIn}
            </>
          ) : (
            <>
              <LogIn size={18} />
              {authCopy.loginButton}
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-sm text-slate-500">
        {authCopy.noAccount}{' '}
        <button type="button" onClick={onSwitchToRegister} className="font-semibold text-sky-600 hover:text-sky-500">
          {authCopy.registerNow}
        </button>
      </div>
    </AuthShell>
  );
}
