import React from 'react';
import { getUiCopy } from '../../i18n/locale.js';

export function AuthShell({ locale = 'zh', title, subtitle, children, footer }) {
  const authCopy = getUiCopy(locale).auth;
  const notes = locale === 'en'
    ? [
        'Minimal interface, bilingual shell.',
        'Sign in to save stats and manage your token.',
      ]
    : [
        '极简界面，支持中英切换。',
        '登录后可保存战绩并管理令牌。',
      ];

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16 md:px-6">
      <div className="mac-window w-full max-w-5xl overflow-hidden">
        <div className="grid lg:grid-cols-[0.82fr_1.18fr]">
          <section className="hidden border-r border-slate-200/70 bg-white/42 px-8 py-10 lg:flex lg:flex-col lg:justify-between">
            <div className="space-y-5">
              <div className="mac-window-chrome">
                <span className="mac-window-dot mac-dot-red" />
                <span className="mac-window-dot mac-dot-yellow" />
                <span className="mac-window-dot mac-dot-green" />
              </div>
              <div>
                <div className="mac-eyebrow">{authCopy.productName}</div>
                <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-slate-950">
                  {authCopy.heroTitle}
                </h1>
                <p className="mt-4 text-base leading-7 text-slate-500">{authCopy.heroBody}</p>
              </div>
            </div>

            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note} className="mac-muted-card text-sm leading-6 text-slate-500">
                  {note}
                </div>
              ))}
            </div>
          </section>

          <section className="px-6 py-8 md:px-10 md:py-10">
            <div className="mb-8 lg:hidden">
              <div className="mac-window-chrome">
                <span className="mac-window-dot mac-dot-red" />
                <span className="mac-window-dot mac-dot-yellow" />
                <span className="mac-window-dot mac-dot-green" />
              </div>
            </div>

            <div className="mb-8">
              <div className="mac-eyebrow">{authCopy.productName}</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
            </div>

            {children}
            {footer && <div className="mt-8">{footer}</div>}
          </section>
        </div>
      </div>
    </div>
  );
}
