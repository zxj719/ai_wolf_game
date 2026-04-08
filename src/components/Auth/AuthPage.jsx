import React, { useState, useEffect } from 'react';
import { LoginForm } from './LoginForm.jsx';
import { RegisterForm } from './RegisterForm.jsx';
import { ForgotPasswordForm } from './ForgotPasswordForm.jsx';
import { ResetPasswordForm } from './ResetPasswordForm.jsx';
import { VerifyEmailPage } from './VerifyEmailPage.jsx';
import { getUiCopy } from '../../i18n/locale.js';

export function AuthPage({ onGuestPlay, locale = 'zh' }) {
  const authCopy = getUiCopy(locale).auth;
  const dashboardCopy = getUiCopy(locale).dashboard;
  const termsJoiner = locale === 'en' ? 'and' : '与';

  const [view, setView] = useState('login');
  const [resetToken, setResetToken] = useState(null);
  const [verifyToken, setVerifyToken] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;

    if (path === '/reset-password' || params.get('reset')) {
      const token = params.get('token');
      if (token) {
        setResetToken(token);
        setView('reset');
      }
    }

    if (path === '/verify-email' || params.get('verify')) {
      const token = params.get('token');
      if (token) {
        setVerifyToken(token);
        setView('verify');
      }
    }
  }, []);

  const handleBackToLogin = () => {
    window.history.replaceState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
    setView('login');
    setResetToken(null);
    setVerifyToken(null);
  };

  const guestFooter = onGuestPlay && (view === 'login' || view === 'register') ? (
    <div className="px-4 pb-10 text-center">
      <button type="button" onClick={onGuestPlay} className="mac-button mac-button-secondary">
        {authCopy.guestEnter}
      </button>
      <p className="mt-4 text-xs leading-6 text-slate-400">
        {authCopy.guestTermsPrefix}{' '}
        <a href="/terms.html" className="text-slate-500 hover:text-slate-700">{dashboardCopy.footerTerms}</a>
        {' '}{termsJoiner}{' '}
        <a href="/privacy.html" className="text-slate-500 hover:text-slate-700">{dashboardCopy.footerPrivacy}</a>
      </p>
    </div>
  ) : null;

  const renderView = () => {
    switch (view) {
      case 'register':
        return <RegisterForm locale={locale} onSwitchToLogin={() => setView('login')} />;
      case 'forgot':
        return <ForgotPasswordForm locale={locale} onBack={handleBackToLogin} />;
      case 'reset':
        return <ResetPasswordForm locale={locale} token={resetToken} onSuccess={handleBackToLogin} onBack={handleBackToLogin} />;
      case 'verify':
        return <VerifyEmailPage locale={locale} token={verifyToken} onSuccess={handleBackToLogin} onBack={handleBackToLogin} />;
      default:
        return (
          <LoginForm
            locale={locale}
            onSwitchToRegister={() => setView('register')}
            onForgotPassword={() => setView('forgot')}
          />
        );
    }
  };

  if (!guestFooter) {
    return <main aria-label={authCopy.productName}>{renderView()}</main>;
  }

  return (
    <main aria-label={authCopy.productName}>
      {renderView()}
      {guestFooter}
    </main>
  );
}
