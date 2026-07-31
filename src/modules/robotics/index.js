import { lazy } from 'react';
import { ROUTES } from '../../shell/paths';

const RoboticsRoute = lazy(() => import('./RoboticsRoute'));

/**
 * 机器人学习模块 — 与家庭网球平级的首页板块。
 *
 * 讲义本体是 Tutorials4intern/docs 里的静态 HTML，复制到 public/robotics/。
 * 本模块只提供一层带"返回主页"的外壳，不改动讲义源文件。
 */
const roboticsModule = {
  id: 'robotics',
  title: { zh: '机器人学习', en: 'Robotics Course' },
  blurb: {
    zh: 'ROS2 入门讲义 · Day 0 课前预习',
    en: 'ROS2 onboarding course · Day 0 prep',
  },
  theme: 'light',
  backend: 'cf-workers',
  routes: [
    { path: ROUTES.ROBOTICS, component: RoboticsRoute, requiresAuth: false },
  ],
  home: { visible: true, order: 26 },
};

export default roboticsModule;
