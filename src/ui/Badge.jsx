import { forwardRef } from 'react';

const TONES = {
  neutral: 'bg-bg-sunken text-ink-muted border border-line',
  accent:  'bg-accent-soft text-accent border border-accent/20',
  danger:  'bg-danger/10 text-danger border border-danger/20',
  success: 'bg-success/10 text-success border border-success/20',
  warning: 'bg-warning/10 text-warning border border-warning/20',
};

export const Badge = forwardRef(function Badge(
  { tone = 'neutral', className = '', children, ...rest },
  ref
) {
  return (
    <span
      ref={ref}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-xs font-medium ${TONES[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
});
