import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SitesPage } from '../SitesPage.jsx';

describe('SitesPage', () => {
  it('shows the music arrangement lab entry in English', () => {
    const html = renderToStaticMarkup(<SitesPage onBack={() => {}} locale="en" />);

    expect(html).toContain('Music arrangement lab');
    expect(html).toContain('Upload an MP3');
  });
});
