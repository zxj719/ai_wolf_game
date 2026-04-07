import { useEffect, useMemo, useState } from 'react';
import { layoutWithLines, prepareWithSegments } from '@chenglou/pretext';

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

export function useBalancedHeadline({ text, font, width, lineHeight }) {
  const fontsReady = useFontsReady();

  const prepared = useMemo(() => {
    if (!fontsReady || !text || !font) {
      return null;
    }

    return prepareWithSegments(text, font);
  }, [font, fontsReady, text]);

  return useMemo(() => {
    if (!prepared || width <= 0) {
      return [];
    }

    const minWidth = Math.max(220, width * 0.68);
    let bestLines = [];
    let bestScore = Number.POSITIVE_INFINITY;

    for (let step = 0; step <= 8; step += 1) {
      const candidateWidth = minWidth + ((width - minWidth) * step) / 8;
      const { lines = [] } = layoutWithLines(prepared, candidateWidth, lineHeight);
      const cleanedLines = lines
        .map((line) => line.text?.trim())
        .filter(Boolean);

      if (!cleanedLines.length) {
        continue;
      }

      const lineLengths = cleanedLines.map((line) => line.length);
      const average = lineLengths.reduce((sum, value) => sum + value, 0) / lineLengths.length;
      const variance = lineLengths.reduce((sum, value) => sum + Math.abs(value - average), 0);
      const lastLinePenalty = Math.abs((lineLengths.at(-1) ?? average) - average) * 1.4;
      const lineCountPenalty = cleanedLines.length > 4 ? (cleanedLines.length - 4) * 5 : 0;
      const score = variance + lastLinePenalty + lineCountPenalty;

      if (score < bestScore) {
        bestScore = score;
        bestLines = cleanedLines;
      }
    }

    return bestLines.length > 0 ? bestLines : [text];
  }, [lineHeight, prepared, width]);
}
