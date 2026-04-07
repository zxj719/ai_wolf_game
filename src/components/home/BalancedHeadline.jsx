import { useElementWidth } from '../../hooks/useElementWidth';
import { useBalancedHeadline } from '../../hooks/useBalancedHeadline';

export function BalancedHeadline({
  text,
  className = '',
  lineClassName = '',
  font = '700 58px "Noto Serif SC"',
  lineHeight = 74,
}) {
  const { ref, width } = useElementWidth();
  const lines = useBalancedHeadline({ text, font, width, lineHeight });

  return (
    <div ref={ref} className={className} aria-label={text}>
      {lines.length > 0 ? (
        lines.map((line, index) => (
          <span key={`${line}-${index}`} className={lineClassName}>
            {line}
          </span>
        ))
      ) : (
        <span className={lineClassName}>{text}</span>
      )}
    </div>
  );
}
