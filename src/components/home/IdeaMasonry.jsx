import { useEffect, useMemo, useState } from 'react';
import { layout, prepare } from '@chenglou/pretext';
import { ArrowUpRight } from 'lucide-react';
import { useElementWidth } from '../../hooks/useElementWidth';

const TITLE_FONT = '700 24px "Noto Serif SC"';
const BODY_FONT = '500 15px "Outfit"';
const TITLE_LINE_HEIGHT = 32;
const BODY_LINE_HEIGHT = 24;
const GAP = 24;

function useFontsReady() {
  const [fontsReady, setFontsReady] = useState(typeof document === 'undefined');

  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts?.ready) {
      setFontsReady(true);
      return undefined;
    }

    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) {
        setFontsReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return fontsReady;
}

export function IdeaMasonry({ items }) {
  const { ref, width } = useElementWidth();
  const fontsReady = useFontsReady();

  const columnCount = width >= 1080 ? 3 : width >= 720 ? 2 : 1;
  const contentWidth = useMemo(() => {
    if (!width) {
      return 260;
    }

    const totalGap = GAP * (columnCount - 1);
    return Math.max(220, Math.floor((width - totalGap) / columnCount) - 48);
  }, [columnCount, width]);

  const preparedItems = useMemo(() => {
    if (!fontsReady) {
      return [];
    }

    return items.map((item) => ({
      ...item,
      preparedTitle: prepare(item.title, TITLE_FONT),
      preparedDescription: prepare(item.description, BODY_FONT),
    }));
  }, [fontsReady, items]);

  const measuredItems = useMemo(() => {
    if (!preparedItems.length) {
      return items.map((item) => ({ ...item, minHeight: 240 }));
    }

    return preparedItems.map((item) => {
      const titleMetrics = layout(item.preparedTitle, contentWidth, TITLE_LINE_HEIGHT);
      const descriptionMetrics = layout(item.preparedDescription, contentWidth, BODY_LINE_HEIGHT);
      const minHeight = 176 + titleMetrics.height + descriptionMetrics.height;

      return {
        ...item,
        minHeight,
      };
    });
  }, [contentWidth, items, preparedItems]);

  return (
    <div
      ref={ref}
      className="grid gap-6"
      style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
    >
      {measuredItems.map((item) => (
        <article
          key={item.title}
          className="rounded-[28px] border border-stone-900/10 bg-white/75 p-6 shadow-[0_20px_45px_rgba(28,25,23,0.08)] backdrop-blur"
          style={{ minHeight: `${item.minHeight}px` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">{item.category}</p>
              <h3 className="font-display mt-3 text-2xl leading-tight text-stone-900">{item.title}</h3>
            </div>
            {item.link ? (
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-900/10 text-stone-700 transition-colors hover:bg-stone-900 hover:text-stone-50"
                aria-label={`打开 ${item.title}`}
              >
                <ArrowUpRight size={16} />
              </a>
            ) : null}
          </div>

          <p className="mt-4 text-sm leading-7 text-stone-600">{item.description}</p>
          <p className="mt-6 text-xs uppercase tracking-[0.2em] text-stone-400">{item.meta}</p>
        </article>
      ))}
    </div>
  );
}
