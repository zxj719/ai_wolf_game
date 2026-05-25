import { describe, expect, it } from 'vitest';
import { normalizeSong } from '../chordsService.js';

describe('normalizeSong', () => {
  it('builds stable artifact URLs from a completed song payload', () => {
    const song = normalizeSong({
      id: 'song_abc',
      status: 'completed',
      source_filename: 'demo.mp3',
      player_artifact: 'demo_stems.html',
      analysis_artifact: 'demo_analysis.json',
      artifacts: [
        { name: 'demo_vocals.wav', path: 'demo_vocals.wav', kind: 'stem' },
        { name: 'demo_drums.wav', path: 'demo_drums.wav', kind: 'stem' },
      ],
      analysis: {
        arrangement: {
          summary: 'Layered chorus lift.',
          style_tags: ['pop'],
        },
      },
    });

    expect(song.id).toBe('song_abc');
    expect(song.playerUrl).toBe('/chords/song_abc/demo_stems.html');
    expect(song.analysisUrl).toBe('/chords/song_abc/demo_analysis.json');
    expect(song.artifacts[0].url).toBe('/chords/song_abc/demo_vocals.wav');
    expect(song.arrangement.summary).toBe('Layered chorus lift.');
  });
});
