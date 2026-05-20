import { lazy } from 'react';
import { ROUTES } from '../../shell/paths';

const ChordsRoute = lazy(() => import('./ChordsRoute'));

const chordsModule = {
  id: 'chords',
  title: { zh: '音乐编曲实验室', en: 'Music Lab' },
  blurb: {
    zh: '云端分轨与编曲分析',
    en: 'Cloud stem separation and arrangement analysis',
  },
  theme: 'light',
  backend: 'cf-workers',
  routes: [
    { path: ROUTES.CHORDS, component: ChordsRoute, requiresAuth: false },
  ],
  home: { visible: true, order: 30 },
};

export default chordsModule;
