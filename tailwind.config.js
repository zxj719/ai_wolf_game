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
        market: {
          up:   'var(--market-up)',
          down: 'var(--market-down)',
        },
        role: {
          wolf: 'var(--role-wolf)', 'wolf-soft': 'var(--role-wolf-soft)',
          seer: 'var(--role-seer)', 'seer-soft': 'var(--role-seer-soft)',
          witch: 'var(--role-witch)', 'witch-soft': 'var(--role-witch-soft)',
          hunter: 'var(--role-hunter)', 'hunter-soft': 'var(--role-hunter-soft)',
          guard: 'var(--role-guard)', 'guard-soft': 'var(--role-guard-soft)',
          magician: 'var(--role-magician)', 'magician-soft': 'var(--role-magician-soft)',
          knight: 'var(--role-knight)', 'knight-soft': 'var(--role-knight-soft)',
          dreamweaver: 'var(--role-dreamweaver)', 'dreamweaver-soft': 'var(--role-dreamweaver-soft)',
          villager: 'var(--role-villager)', 'villager-soft': 'var(--role-villager-soft)',
        },
        phase: {
          night: 'var(--phase-night)', 'night-bg': 'var(--phase-night-bg)',
          day: 'var(--phase-day)', 'day-bg': 'var(--phase-day-bg)',
          vote: 'var(--phase-vote)', resolution: 'var(--phase-resolution)',
        },
        state: {
          selected: 'var(--state-selected)', 'selected-soft': 'var(--state-selected-soft)',
          speaking: 'var(--state-speaking)', dead: 'var(--state-dead)',
          'win-good': 'var(--state-win-good)', 'win-evil': 'var(--state-win-evil)',
          thinking: 'var(--state-thinking)',
        },
      },
      borderColor: {
        line:          'var(--border)',
        'line-strong': 'var(--border-strong)',
      },
      borderRadius: {
        card:   'var(--radius-card)',
        button: 'var(--radius-button)',
        input:  'var(--radius-input)',
        pill:   'var(--radius-pill)',
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
