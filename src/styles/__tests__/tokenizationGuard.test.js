import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 静态守门：已 token 化的模块源码里不得再出现非语义硬编码中性色。
// 读源码而非挂载组件 —— 对带 context/hook 的复杂组件也稳健。
// 维护：新增/重构这些模块时若回归 text-slate-* / bg-white/7x，本测试会失败。

const ROOT = process.cwd();

// 已完成 token 化、必须保持零中性硬编码的文件
const TOKENIZED = [
  'src/components/Auth/AuthShell.jsx',
  'src/components/Auth/AuthPage.jsx',
  'src/components/Auth/LoginForm.jsx',
  'src/components/Auth/RegisterForm.jsx',
  'src/components/Auth/ForgotPasswordForm.jsx',
  'src/components/Auth/ResetPasswordForm.jsx',
  'src/components/Auth/VerifyEmailPage.jsx',
  'src/components/ReplayViewer.jsx',
  'src/components/GameHistoryTable.jsx',
  'src/components/SidePanels.jsx',
  'src/components/UserStats.jsx',
  'src/components/TokenManager.jsx',
  'src/components/GameLog.jsx',
  'src/components/SpeechPanel.jsx',
  'src/components/QueueGate.jsx',
  'src/components/Dashboard.jsx',
  'src/components/home/HomePortalCard.jsx',
  'src/components/home/IdeaMasonry.jsx',
  'src/components/SitesPage.jsx',
  'src/components/NovelWorkspace.jsx',
  'src/components/ChordsPage.jsx',
  'src/components/StemPlayer.jsx',
  'src/components/Stock/StockPage.jsx',
  'src/components/Stock/PaperTrading.jsx',
  'src/components/Stock/StockScreener.jsx',
  'src/components/Stock/TradePanel.jsx',
  'src/components/Stock/OrderBook.jsx',
  'src/components/Stock/StockDetail.jsx',
  'src/components/Stock/QuoteBar.jsx',
  'src/components/Stock/BatchAddModal.jsx',
  'src/components/Stock/CandlestickChart.jsx',
  'src/components/Stock/PriceLineChart.jsx',
  'src/components/Stock/WatchlistSorter.jsx',
];

// 允许保留的硬编码色（数据驱动调色板 / 视频上层覆盖 chrome），不在守门范围
const ALLOWLIST = [
  'src/components/Stock/WatchlistTags.jsx', // 用户自选标签 8 色调色板（数据驱动 identity）
  'src/modules/chat/components/VideoCallPanel.jsx', // 视频上层字幕/控件
  'src/modules/chat/components/DraggablePiP.jsx', // 视频上层缩放手柄
];

const NEUTRAL_TEXT = /(?:text|bg|border|ring|divide|from|to|via)-(?:slate|zinc|gray|neutral)-[0-9]/;
const RAW_WHITE_SURFACE = /bg-white\/[0-9]/;

describe('UI 统一 token 化守门', () => {
  for (const rel of TOKENIZED) {
    it(`${rel} 无非语义硬编码中性色`, () => {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      const neutral = src.match(new RegExp(NEUTRAL_TEXT, 'g')) || [];
      const white = src.match(new RegExp(RAW_WHITE_SURFACE, 'g')) || [];
      expect({ file: rel, neutral, white }).toEqual({ file: rel, neutral: [], white: [] });
    });
  }

  it('allowlist 文件存在（防止路径漂移使守门静默失效）', () => {
    for (const rel of ALLOWLIST) {
      expect(() => readFileSync(join(ROOT, rel), 'utf8')).not.toThrow();
    }
  });
});
