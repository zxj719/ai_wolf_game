import { lazy } from 'react';
import { ROUTES } from '../../shell/paths';

const BacktestRoute = lazy(() => import('./BacktestRoute'));

const backtestModule = {
  id: 'backtest',
  title: { zh: '反向T回测', en: 'Reverse-T Backtest' },
  blurb: {
    zh: '预设策略模板 + 历史K线回测，纯历史模拟，不构成投资建议',
    en: 'Preset strategy templates backtested against historical bars — simulation only, not investment advice',
  },
  theme: 'light',
  backend: 'ecs-backtest',
  routes: [
    { path: ROUTES.BACKTEST, component: BacktestRoute, requiresAuth: false },
  ],
  home: { visible: true, order: 25 },
};

export default backtestModule;
