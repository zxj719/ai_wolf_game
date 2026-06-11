import { lazy } from 'react';
import { ROUTES } from '../../shell/paths';

const TennisRoute = lazy(() => import('./TennisRoute'));

const tennisModule = {
  id: 'tennis',
  title: { zh: '家庭网球公开赛', en: 'Family Tennis Open' },
  blurb: {
    zh: '相爱相杀前传 · 全网排行榜',
    en: 'Family showdown with a global leaderboard',
  },
  theme: 'dark',
  backend: 'cf-workers',
  routes: [
    { path: ROUTES.TENNIS, component: TennisRoute, requiresAuth: false },
  ],
  home: { visible: true, order: 25 },
};

export default tennisModule;
