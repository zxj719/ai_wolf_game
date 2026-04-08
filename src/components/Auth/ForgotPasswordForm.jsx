import React, { useState } from 'react';
import { Mail, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import { authService } from '../../services/authService';
import { getUiCopy } from '../../i18n/locale.js';
import { AuthShell } from './AuthShell.jsx';

export function ForgotPasswordForm({ onBack, locale = 'zh' }) {
  const authCopy = getUiCopy(locale).auth;

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!email) {
      setError(authCopy.emailRequired);
      return;
    }

    setIsLoading(true);
    try {
      await authService.forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err.message || authCopy.sendFailed);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthShell locale={locale} title={authCopy.forgotTitle} subtitle={authCopy.forgotDescription}>
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/90 p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600">
            <CheckCircle size={28} />
          </div>
          <div className="text-base font-semibold text-slate-900">{authCopy.sendReset}</div>
          <p className="mt-2 text-sm leading-6 text-slate-500">{authCopy.forgotDescription}</p>
          <button type="button" onClick={onBack} className="mac-button mac-button-primary mt-6">
            {authCopy.backToLogin}
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell locale={locale} title={authCopy.forgotTitle} subtitle={authCopy.forgotDescription}>
      {error && <div className="mb-6 rounded-[22px] border border-rose-200 bg-rose-50/90 p-4 text-sm text-rose-600">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{authCopy.emailAddress}</span>
          <input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mac-input"
            placeholder={authCopy.emailPlaceholder}
            disabled={isLoading}
            autoComplete="email"
          />
        </label>

        <button type="submit" disabled={isLoading} className="mac-button mac-button-primary w-full justify-center py-3">
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {authCopy.sending}
            </>
          ) : (
            <>
              <Mail size={18} />
              {authCopy.sendReset}
            </>
          )}
        </button>
      </form>

      <button type="button" onClick={onBack} className="mac-button mac-button-ghost mt-6">
        <ArrowLeft size={16} />
        {authCopy.backToLogin}
      </button>
    </AuthShell>
  );
}
