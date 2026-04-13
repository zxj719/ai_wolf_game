import { forwardRef } from 'react';
import { Spinner } from './Spinner';

const VARIANTS = {
  primary:   'bg-accent text-white hover:bg-accent-hover shadow-card',
  secondary: 'bg-bg-raised text-ink border border-line hover:bg-bg-sunken',
  ghost:     'bg-transparent text-ink-muted hover:bg-bg-raised hover:text-ink',
  danger:    'bg-danger text-white hover:opacity-90 shadow-card',
};

const SIZES = {
  sm: 'h-8 px-3 text-xs rounded-button',
  md: 'h-10 px-4 text-sm rounded-button',
  lg: 'h-12 px-6 text-base rounded-button',
};

export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    className = '',
    type = 'button',
    children,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
});
