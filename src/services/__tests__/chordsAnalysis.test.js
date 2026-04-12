import { describe, expect, it } from 'vitest';
import {
  buildTrackSummary,
  normalizeArrangementResponse,
} from '../chordsAnalysis.js';

describe('buildTrackSummary', () => {
  it('builds a browser-side summary with energy sections and highlights', () => {
    const summary = buildTrackSummary({
      file: {
        name: 'night-drive.mp3',
        size: 4_000_000,
        type: 'audio/mpeg',
      },
      audio: {
        duration: 180,
        sampleRate: 44_100,
        numberOfChannels: 2,
      },
      energyFrames: [
        0.12,
        0.15,
        0.18,
        0.34,
        0.56,
        0.72,
        0.81,
        0.67,
        0.44,
        0.2,
      ],
    });

    expect(summary.file_name).toBe('night-drive.mp3');
    expect(summary.duration).toBe(180);
    expect(summary.channels).toBe(2);
    expect(summary.energy_sections.length).toBeGreaterThan(3);
    expect(summary.energy_sections[0].energy_level).toBe('low');
    expect(summary.energy_sections.at(-1).energy_level).toBe('low');
    expect(summary.arrangement_signals.climax_window.index).toBe(7);
    expect(summary.arrangement_signals.dynamics.shape).toBe('build-and-release');
  });
});

describe('normalizeArrangementResponse', () => {
  it('normalizes incomplete MiniMax output into stable UI data', () => {
    const normalized = normalizeArrangementResponse({
      summary: 'Slow intro, then a clean lift into the hook.',
      style_tags: ['alt-pop'],
      sections: [
        {
          name: 'Lift',
          time_start: 36,
          time_end: 68,
          energy: 'medium',
          arrangement_notes: ['Drums arrive.'],
        },
      ],
    });

    expect(normalized.summary).toContain('Slow intro');
    expect(normalized.style_tags).toEqual(['alt-pop']);
    expect(normalized.mood_tags).toEqual([]);
    expect(normalized.sections[0].name).toBe('Lift');
    expect(normalized.sections[0].arrangement_notes).toEqual(['Drums arrive.']);
    expect(normalized.listening_focus).toEqual([]);
    expect(normalized.mix_highlights).toEqual([]);
  });
});
