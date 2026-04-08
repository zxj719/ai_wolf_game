import React from 'react';
import { Sparkles } from 'lucide-react';
import { getUiCopy } from '../../i18n/locale.js';

export function AuthShell({ locale = 'zh', title, subtitle, children, footer }) {
  const authCopy = getUiCopy(locale).auth;
  const featureA = locale === 'en'
    ? {
        title: 'macOS-inspired UI',
        body: 'Rounded glass panels, restrained motion, and a lighter desktop-like hierarchy.',
      }
    : {
        title: 'macOS 风格界面',
        body: '圆角玻璃面板、克制动效和更像桌面应用的浅色层级。',
      };
  const featureB = locale === 'en'
    ? {
        title: 'Bilingual shell',
        body: 'Switch between 中文 and English without leaving the current route.',
      }
    : {
        title: '双语外壳',
        body: '不离开当前页面即可在中文和 English 之间切换。',
      };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-24 md:px-6">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="mac-window hidden overflow-hidden p-8 lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="mac-window-chrome">
              <span className="mac-window-dot mac-dot-red" />
              <span className="mac-window-dot mac-dot-yellow" />
              <span className="mac-window-dot mac-dot-green" />
            </div>
            <div className="mt-10 space-y-4">
              <div className="mac-badge">
                <Sparkles size={14} />
                {authCopy.productName}
              </div>
              <h1 className="text-4xl font-semibold leading-tight text-slate-900">{authCopy.heroTitle}</h1>
              <p className="max-w-xl text-base leading-7 text-slate-500">{authCopy.heroBody}</p>
            </div>
          </div>
            <div className="grid gap-3">
            <div className="mac-panel p-5">
              <div className="text-sm font-semibold text-slate-900">{featureA.title}</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">{featureA.body}</div>
            </div>
            <div className="mac-panel p-5">
              <div className="text-sm font-semibold text-slate-900">{featureB.title}</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">{featureB.body}</div>
            </div>
          </div>
        </section>

        <section className="mac-window overflow-hidden">
          <div className="mac-toolbar">
            <div className="mac-window-chrome">
              <span className="mac-window-dot mac-dot-red" />
              <span className="mac-window-dot mac-dot-yellow" />
              <span className="mac-window-dot mac-dot-green" />
            </div>
            <div className="text-right">
              <div className="mac-eyebrow">{authCopy.productName}</div>
            </div>
          </div>

          <div className="px-6 py-8 md:px-8">
            <div className="mb-8">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
            </div>
            {children}
            {footer && <div className="mt-8">{footer}</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
