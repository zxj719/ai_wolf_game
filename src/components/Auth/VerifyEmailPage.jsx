import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { authService } from '../../services/authService';
import { getUiCopy } from '../../i18n/locale.js';
import { AuthShell } from './AuthShell.jsx';

export function VerifyEmailPage({ token, onSuccess, onBack, locale = 'zh' }) {
  const authCopy = getUiCopy(locale).auth;
  const common = getUiCopy(locale).common;
  const [status, setStatus] = useState('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError(authCopy.verifyInvalid);
      return;
    }

    const verify = async () => {
      try {
        await authService.verifyEmail(token);
        setStatus('success');
      } catch (err) {
        setStatus('error');
        setError(err.message || authCopy.verifyInvalid);
      }
    };

    verify();
  }, [authCopy.verifyInvalid, token]);

  if (status === 'verifying') {
    return (
      <AuthShell locale={locale} title={authCopy.verifyTitle} subtitle={authCopy.verifyLoading}>
        <div className="rounded-[24px] border border-sky-200 bg-sky-50/90 p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-500/12 text-sky-600">
            <Loader2 size={28} className="animate-spin" />
          </div>
          <div className="text-base font-semibold text-slate-900">{authCopy.verifyLoading}</div>
        </div>
      </AuthShell>
    );
  }

  if (status === 'success') {
    return (
      <AuthShell locale={locale} title={authCopy.verifySuccess} subtitle={authCopy.verifySuccessDescription}>
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/90 p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600">
            <CheckCircle size={28} />
          </div>
          <div className="text-base font-semibold text-slate-900">{authCopy.verifySuccess}</div>
          <p className="mt-2 text-sm leading-6 text-slate-500">{authCopy.verifySuccessDescription}</p>
          <button type="button" onClick={onSuccess || onBack} className="mac-button mac-button-primary mt-6">
            {authCopy.continueLabel}
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell locale={locale} title={authCopy.verifyError} subtitle={error || authCopy.verifyInvalid}>
      <div className="rounded-[24px] border border-rose-200 bg-rose-50/90 p-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/12 text-rose-600">
          <XCircle size={28} />
        </div>
        <div className="text-base font-semibold text-slate-900">{authCopy.verifyError}</div>
        <p className="mt-2 text-sm leading-6 text-slate-500">{error || authCopy.verifyInvalid}</p>
        <button type="button" onClick={onBack} className="mac-button mac-button-primary mt-6">
          {common.back}
        </button>
      </div>
    </AuthShell>
  );
}
