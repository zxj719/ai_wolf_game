import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { authService } from '../../services/authService';
import { getUiCopy } from '../../i18n/locale.js';
import { AuthShell } from './AuthShell.jsx';

export function ResetPasswordForm({ token, onSuccess, onBack, locale = 'zh' }) {
  const authCopy = getUiCopy(locale).auth;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [passwordChecks, setPasswordChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
  });

  useEffect(() => {
    setPasswordChecks({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
    });
  }, [password]);

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!isPasswordValid) {
      setError(authCopy.passwordWeak);
      return;
    }

    if (!passwordsMatch) {
      setError(authCopy.passwordMismatch);
      return;
    }

    setIsLoading(true);
    try {
      await authService.resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err.message || authCopy.resetInvalid);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthShell locale={locale} title={authCopy.resetSuccess} subtitle={authCopy.resetSuccessDescription}>
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/90 p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600">
            <CheckCircle size={28} />
          </div>
          <div className="text-base font-semibold text-slate-900">{authCopy.resetSuccess}</div>
          <p className="mt-2 text-sm leading-6 text-slate-500">{authCopy.resetSuccessDescription}</p>
          <button type="button" onClick={onSuccess || onBack} className="mac-button mac-button-primary mt-6">
            {authCopy.goLogin}
          </button>
        </div>
      </AuthShell>
    );
  }

  if (!token) {
    return (
      <AuthShell locale={locale} title={authCopy.invalidLink} subtitle={authCopy.resetInvalid}>
        <div className="rounded-[24px] border border-rose-200 bg-rose-50/90 p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/12 text-rose-600">
            <XCircle size={28} />
          </div>
          <div className="text-base font-semibold text-slate-900">{authCopy.invalidLink}</div>
          <p className="mt-2 text-sm leading-6 text-slate-500">{authCopy.resetInvalid}</p>
          <button type="button" onClick={onBack} className="mac-button mac-button-primary mt-6">
            {authCopy.backToLogin}
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell locale={locale} title={authCopy.resetTitle} subtitle={authCopy.resetDescription}>
      {error && <div className="mb-6 rounded-[22px] border border-rose-200 bg-rose-50/90 p-4 text-sm text-rose-600">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{authCopy.password}</span>
          <div className="relative">
            <input
              id="reset-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mac-input pr-12"
              placeholder={authCopy.newPasswordPlaceholder}
              disabled={isLoading}
              autoComplete="new-password"
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
          <div className="mt-3 grid gap-2 text-sm">
            <div className={passwordChecks.length ? 'text-emerald-600' : 'text-slate-400'}>{authCopy.passwordRules[0]}</div>
            <div className={passwordChecks.lowercase ? 'text-emerald-600' : 'text-slate-400'}>{authCopy.passwordRules[1]}</div>
            <div className={passwordChecks.uppercase ? 'text-emerald-600' : 'text-slate-400'}>{authCopy.passwordRules[2]}</div>
            <div className={passwordChecks.number ? 'text-emerald-600' : 'text-slate-400'}>{authCopy.passwordRules[3]}</div>
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{authCopy.confirmPassword}</span>
          <input
            id="reset-confirm-password"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="mac-input"
            placeholder={authCopy.confirmPasswordPlaceholder}
            disabled={isLoading}
            autoComplete="new-password"
          />
          {confirmPassword && !passwordsMatch && (
            <p className="mt-2 text-sm text-rose-600">{authCopy.passwordMismatch}</p>
          )}
          {passwordsMatch && <p className="mt-2 text-sm text-emerald-600">{authCopy.passwordMatched}</p>}
        </label>

        <button
          type="submit"
          disabled={isLoading || !isPasswordValid || !passwordsMatch}
          className="mac-button mac-button-primary w-full justify-center py-3"
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {authCopy.sending}
            </>
          ) : (
            <>
              <Lock size={18} />
              {authCopy.resetTitle}
            </>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
