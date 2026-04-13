import { forwardRef } from 'react';

export const Skeleton = forwardRef(function Skeleton(
  { className = '', ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={`animate-pulse bg-bg-sunken rounded ${className}`}
      {...rest}
    />
  );
});
