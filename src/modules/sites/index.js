import { lazy } from 'react';
import { ROUTES } from '../../shell/paths';

const SitesRoute = lazy(() => import('./SitesRoute'));

/**
 * Sites 模块 — Phase 3 过渡占位。
 *
 * 继续挂在 /sites 单一路由下复用 SitesPage。Phase 4 删除整个目录，
 * 改为 chords / stock / blog 三个并列模块。
 */
const sitesModule = {
  id: 'sites',
  title: { zh: '项目与实验', en: 'Projects & Labs' },
  blurb: {
    zh: '临时聚合页：音乐、行情、静态站点。',
    en: 'Temporary aggregate: music, market, static site.',
  },
  theme: 'light',
  backend: 'cf-workers',
  routes: [
    { path: ROUTES.SITES, component: SitesRoute, requiresAuth: false },
  ],
  home: { visible: false }, // Phase 4 拆分后才进卡片墙
};

export default sitesModule;
