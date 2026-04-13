import { forwardRef } from 'react';

const PADDINGS = {
  none: 'p-0',
  sm:   'p-3',
  md:   'p-5',
  lg:   'p-7',
};

export const Card = forwardRef(function Card(
  {
    as: Tag = 'div',
    padding = 'md',
    interactive = false,
    className = '',
    children,
    ...rest
  },
  ref
) {
  return (
    <Tag
      ref={ref}
      className={`bg-bg-raised border border-line rounded-card shadow-card ${PADDINGS[padding]} ${
        interactive ? 'transition-colors hover:border-line-strong cursor-pointer' : ''
      } ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
});
