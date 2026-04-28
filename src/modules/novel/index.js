import { lazy } from 'react';
import { ROUTES } from '../../shell/paths';

const NovelRoute = lazy(() => import('./NovelRoute'));

const novelModule = {
  id: 'novel',
  title: { zh: '小说工作台', en: 'Novel Workspace' },
  blurb: {
    zh: 'Meta Writing 长篇小说项目与 Codex 生成工作流',
    en: 'Meta Writing long-form novel projects and Codex generation workflow',
  },
  theme: 'light',
  backend: 'ecs-novel',
  routes: [
    { path: ROUTES.NOVEL, component: NovelRoute, requiresAuth: true },
  ],
  home: { visible: true, order: 20 },
};

export default novelModule;
