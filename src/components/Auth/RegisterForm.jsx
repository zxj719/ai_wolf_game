import React, { useState } from 'react';
import { Eye, EyeOff, UserPlus, Loader2, Check, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getUiCopy } from '../../i18n/locale.js';
import { AuthShell } from './AuthShell.jsx';

export function RegisterForm({ onSwitchToLogin, locale = 'zh' }) {
  const { register, error } = useAuth();
  const authCopy = getUiCopy(locale).auth;

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const passwordChecks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
  };

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);
  const isUsernameValid = /^[a-zA-Z0-9_]{3,20}$/.test(username);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError('');

    if (!username || !email || !password) {
      setLocalError(authCopy.fillAllFields);
      return;
    }

    if (!isUsernameValid) {
      setLocalError(authCopy.invalidUsername);
      return;
    }

    if (!isPasswordValid) {
      setLocalError(authCopy.passwordWeak);
      return;
    }

    if (password !== confirmPassword) {
      setLocalError(authCopy.passwordMismatch);
      return;
    }

    setIsLoading(true);
    try {
      const result = await register(username, email, password);
      if (!result.success) {
        setLocalError(result.error || authCopy.registrationFailed);
      }
    } catch (err) {
      setLocalError(err.message || authCopy.registrationFailed);
    } finally {
      setIsLoading(false);
    }
  };

  const Rule = ({ passed, label }) => (
    <div className={`flex items-center gap-2 text-sm ${passed ? 'text-emerald-600' : 'text-slate-400'}`}>
      {passed ? <Check size={14} /> : <X size={14} />}
      <span>{label}</span>
    </div>
  );

  return (
    <AuthShell locale={locale} title={authCopy.registerTitle} subtitle={authCopy.guestDescription}>
      {(localError || error) && (
        <div className="mb-6 rounded-[22px] border border-rose-200 bg-rose-50/90 p-4 text-sm text-rose-600">
          {localError || error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{authCopy.username}</span>
          <input
            id="register-username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="mac-input"
            placeholder={authCopy.usernamePlaceholder}
            disabled={isLoading}
            autoComplete="username"
          />
          {username && !isUsernameValid && <p className="mt-2 text-sm text-rose-600">{authCopy.invalidUsername}</p>}
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{authCopy.email}</span>
          <input
            id="register-email"
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
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{authCopy.password}</span>
          <div className="relative">
            <input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mac-input pr-12"
              placeholder={authCopy.createPasswordPlaceholder}
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

          {password && (
            <div className="mt-3 grid gap-2">
              <Rule passed={passwordChecks.length} label={authCopy.passwordRules[0]} />
              <Rule passed={passwordChecks.lowercase} label={authCopy.passwordRules[1]} />
              <Rule passed={passwordChecks.uppercase} label={authCopy.passwordRules[2]} />
              <Rule passed={passwordChecks.number} label={authCopy.passwordRules[3]} />
            </div>
          )}
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{authCopy.confirmPassword}</span>
          <input
            id="register-confirm-password"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="mac-input"
            placeholder={authCopy.confirmPasswordPlaceholder}
            disabled={isLoading}
            autoComplete="new-password"
          />
          {confirmPassword && password !== confirmPassword && (
            <p className="mt-2 text-sm text-rose-600">{authCopy.passwordMismatch}</p>
          )}
        </label>

        <button
          type="submit"
          disabled={isLoading || !isPasswordValid || !isUsernameValid}
          className="mac-button mac-button-primary w-full justify-center py-3"
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              {authCopy.registering}
            </>
          ) : (
            <>
              <UserPlus size={18} />
              {authCopy.registerButton}
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-sm text-slate-500">
        {authCopy.hasAccount}{' '}
        <button type="button" onClick={onSwitchToLogin} className="font-semibold text-sky-600 hover:text-sky-500">
          {authCopy.loginNow}
        </button>
      </div>
    </AuthShell>
  );
}
