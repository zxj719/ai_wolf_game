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
  it('normalizes incomplete LLM output into stable UI data', () => {
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
    expect(normalized.artist).toBe('');
    expect(normalized.album).toBe('');
    expect(normalized.credits).toBe('');
    expect(normalized.stem_roles).toEqual({});
  });

  it('passes through artist, album, credits, and stem_roles', () => {
    const normalized = normalizeArrangementResponse({
      summary: 'R&B groove',
      artist: '方大同',
      album: '橙月 (2008)',
      credits: '方大同 词曲 / Warner Music',
      stem_roles: {
        vocals: { role: '主旋律', timbre: '温暖', arrangement: '全程' },
        bass: { role: '律动', timbre: 'round', arrangement: 'fingerstyle' },
      },
    });

    expect(normalized.artist).toBe('方大同');
    expect(normalized.album).toBe('橙月 (2008)');
    expect(normalized.credits).toBe('方大同 词曲 / Warner Music');
    expect(normalized.stem_roles.vocals.role).toBe('主旋律');
    expect(normalized.stem_roles.bass.timbre).toBe('round');
  });

  it('normalizes structured listening_focus items', () => {
    const normalized = normalizeArrangementResponse({
      listening_focus: [
        { text: '注意钢琴和弦', time: 72.5 },
        { text: '贝斯走向', time: null },
        '纯文本提示',
      ],
    });

    expect(normalized.listening_focus).toEqual([
      { text: '注意钢琴和弦', time: 72.5 },
      { text: '贝斯走向', time: null },
      '纯文本提示',
    ]);
  });
});
