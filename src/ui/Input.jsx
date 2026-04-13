import { forwardRef } from 'react';

const BASE = 'w-full bg-bg-raised text-ink placeholder:text-ink-faint border border-line rounded-button px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60';
const ERROR = 'border-danger focus:border-danger focus:ring-danger/20';

export const Input = forwardRef(function Input(
  { error = false, className = '', type = 'text', ...rest },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      className={`${BASE} ${error ? ERROR : ''} ${className}`}
      {...rest}
    />
  );
});

export const Textarea = forwardRef(function Textarea(
  { error = false, rows = 4, className = '', ...rest },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={`${BASE} resize-y ${error ? ERROR : ''} ${className}`}
      {...rest}
    />
  );
});

export const Select = forwardRef(function Select(
  { error = false, className = '', children, ...rest },
  ref
) {
  return (
    <select
      ref={ref}
      className={`${BASE} ${error ? ERROR : ''} ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
});
