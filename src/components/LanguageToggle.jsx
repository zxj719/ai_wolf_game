import React from 'react';
import { Languages } from 'lucide-react';

export function LanguageToggle({ locale = 'zh', onChange, label = 'Interface language', className = '' }) {
  return (
    <div className={`mac-segmented-control ${className}`} aria-label={label}>
      <div className="mac-segmented-icon">
        <Languages size={14} />
      </div>
      <button
        type="button"
        onClick={() => onChange?.('zh')}
        className={`mac-segment ${locale === 'zh' ? 'is-active' : ''}`}
        aria-pressed={locale === 'zh'}
      >
        ZH
      </button>
      <button
        type="button"
        onClick={() => onChange?.('en')}
        className={`mac-segment ${locale === 'en' ? 'is-active' : ''}`}
        aria-pressed={locale === 'en'}
      >
        EN
      </button>
    </div>
  );
}
