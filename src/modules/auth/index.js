import { lazy } from 'react';
import { ROUTES } from '../../shell/paths';

const AuthRoute = lazy(() => import('./AuthRoute'));

/**
 * Auth 模块 — 认证系统能力，不是"业务模块"。
 *
 * 放进 Registry 只是为了让 Router 统一通过 descriptor 匹配，不会出现在
 * home 卡片墙（home.visible=false）。navGuards 会把已登录访问这些路径的
 * 用户重定向回 /。
 */
const authModule = {
  id: 'auth',
  title: { zh: '账户', en: 'Account' },
  blurb: { zh: '登录 / 注册 / 验证', en: 'Sign in / register / verify' },
  theme: 'light',
  backend: 'cf-workers',
  routes: [
    { path: ROUTES.LOGIN,  component: AuthRoute, requiresAuth: false },
    { path: ROUTES.RESET,  component: AuthRoute, requiresAuth: false },
    { path: ROUTES.VERIFY, component: AuthRoute, requiresAuth: false },
  ],
  home: { visible: false },
};

export default authModule;
