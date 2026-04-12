import { describe, expect, it, vi } from 'vitest';

vi.mock('../apiBase.js', () => ({
  buildApiUrl: (endpoint) => `https://zhaxiaoji.test${endpoint}`,
}));

let normalizeChordsJob;

describe('normalizeChordsJob', () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ normalizeChordsJob } = await import('../chordsService.js'));
  });

  it('builds stable artifact URLs from a completed job payload', () => {
    const job = normalizeChordsJob({
      job: {
        id: 'job_123',
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
      },
    });

    expect(job.id).toBe('job_123');
    expect(job.playerUrl).toBe('https://zhaxiaoji.test/api/chords/jobs/job_123/artifacts/demo_stems.html');
    expect(job.analysisUrl).toBe('https://zhaxiaoji.test/api/chords/jobs/job_123/artifacts/demo_analysis.json');
    expect(job.artifacts[0].url).toBe('https://zhaxiaoji.test/api/chords/jobs/job_123/artifacts/demo_vocals.wav');
    expect(job.arrangement.summary).toBe('Layered chorus lift.');
  });
});
