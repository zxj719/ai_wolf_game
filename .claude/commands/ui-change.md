# 修改 UI 组件

## 主要 UI 文件

| 页面 | 文件 |
|------|------|
| 登录/注册 | `src/components/Auth/` |
| 个人主页 | `src/components/Dashboard.jsx` |
| 游戏设置 | `src/components/SetupScreen.jsx` |
| 游戏界面 | `src/components/GameArena.jsx` |
| 令牌管理 | `src/components/TokenManager.jsx` |
| 用户战绩 | `src/components/UserStats.jsx` |

## 样式规范

- **框架**: TailwindCSS
- **主题**: 暗色 (`bg-zinc-950`, `text-zinc-100`)
- **主色**: `amber-600` / `amber-500`
- **辅色**: `blue-600` / `green-600`
- **边框**: `border-zinc-700` / `border-zinc-800`
- **卡片**: `bg-zinc-900 rounded-xl border border-zinc-700`

## 图标

使用 `lucide-react`:
```jsx
import { Settings, User, Key } from 'lucide-react';
<Settings size={20} className="text-zinc-400" />
```

## 响应式

- 移动端优先
- 使用 `md:` 前缀处理桌面端样式
- 网格: `grid md:grid-cols-2`
