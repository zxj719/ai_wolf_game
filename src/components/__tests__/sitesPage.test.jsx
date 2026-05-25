import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SitesPage } from '../SitesPage.jsx';

describe('SitesPage', () => {
  it('shows the market tool entry in English', () => {
    const html = renderToStaticMarkup(<SitesPage onBack={() => {}} locale="en" />);

    expect(html).toContain('Projects &amp; Labs');
    expect(html).toContain('Market tool');
  });
});
