/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 设计令牌映射 — 全部解析自 src/styles/tokens.css 的 CSS 变量
      // UI 原语应优先使用这些 token 类，跨主题自动适配
      colors: {
        bg: {
          DEFAULT: 'var(--bg)',
          raised:  'var(--bg-raised)',
          sunken:  'var(--bg-sunken)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          muted:   'var(--ink-muted)',
          faint:   'var(--ink-faint)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover:   'var(--accent-hover)',
          soft:    'var(--accent-soft)',
        },
        danger:  'var(--danger)',
        success: 'var(--success)',
        warning: 'var(--warning)',
      },
      borderColor: {
        line:          'var(--border)',
        'line-strong': 'var(--border-strong)',
      },
      borderRadius: {
        card:   'var(--radius-card)',
        button: 'var(--radius-button)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop:  'var(--shadow-pop)',
      },
      ringColor: {
        accent: 'var(--accent)',
      },
    },
  },
  plugins: [],
}
