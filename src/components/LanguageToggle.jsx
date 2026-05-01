import React from 'react';
import { Languages } from 'lucide-react';

export function LanguageToggle({ locale = 'zh', onChange, label = 'Interface language', className = '' }) {
  const labels = locale === 'en'
    ? { zh: 'Chinese', en: 'English' }
    : { zh: '中文', en: '英文' };

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
        title={labels.zh}
      >
        {labels.zh}
      </button>
      <button
        type="button"
        onClick={() => onChange?.('en')}
        className={`mac-segment ${locale === 'en' ? 'is-active' : ''}`}
        aria-pressed={locale === 'en'}
        title={labels.en}
      >
        {labels.en}
      </button>
    </div>
  );
}
