import { lazy } from 'react';
import { ROUTES } from '../../shell/paths';

const ChatRoute = lazy(() => import('./ChatRoute'));

const chatModule = {
  id: 'chat',
  title: { zh: '好友', en: 'Friends' },
  blurb: {
    zh: '好友私聊与实时通话（需登录）',
    en: 'Friends, private chat and live calls (login required)',
  },
  theme: 'light',
  backend: 'cf-workers',
  routes: [
    { path: ROUTES.CHAT, component: ChatRoute, requiresAuth: true },
  ],
  // 游客在首页不显示（Dashboard 用 isGuestMode 控制实际渲染）；
  // 此处保留 visible:true 供未来 registry 卡片墙使用。
  home: { visible: true, order: 25 },
};

export default chatModule;
