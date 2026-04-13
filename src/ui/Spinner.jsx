import { forwardRef } from 'react';

const SIZES = {
  sm: 'h-3.5 w-3.5 border-[1.5px]',
  md: 'h-4 w-4 border-2',
  lg: 'h-6 w-6 border-2',
};

export const Spinner = forwardRef(function Spinner(
  { size = 'md', className = '', ...rest },
  ref
) {
  return (
    <span
      ref={ref}
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-current border-r-transparent ${SIZES[size]} ${className}`}
      {...rest}
    />
  );
});
