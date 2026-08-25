# 反向T策略回测工具 — 设计文档

日期：2026-08-25
状态：待批准

## 背景

`C:\Users\xingj\Documents\agent\autoT\app.py` 是一个独立的 Streamlit 应用（反向T策略回测
Demo），用 akshare 拉取 A 股历史日线/分钟线，跑三套预设策略模板（VWAP回归、开盘缺口回补、
动量衰退）的纯历史回测，展示模拟盈亏。现在要把它接入 zhaxiaoji.com 主站，作为与狼人杀、
小说工作台平级的首页模块，视觉风格必须统一到现有 mac 风格（`mac-panel`/`mac-button` 等
Tailwind 语义类），因此原生 Streamlit 页面不可用（自带完全不同的渲染体系）。

## 已确认决策

1. **整合方式**：React 重写 UI（复用现有 mac 风格组件），Python 只保留纯计算/取数逻辑，
   抽成独立 API 服务。不做 iframe 嵌入，不给 Streamlit 套自定义 CSS 主题——两者都无法做到
   真正的视觉统一。
2. **后端运行时**：新起一个 Python 微服务（FastAPI），而不是把 akshare 取数 + 前复权计算
   移植成 JS。原因：`stock_zh_a_daily(adjust="qfq")` 内部封装了新浪数据源解析和前复权计算，
   这段逻辑已经过验证，重新用 JS 实现有引入细微数据错误的风险，收益（省掉一个运行时）不
   足以覆盖这个风险。
3. **访问权限**：Admin + Guest 都能用（不像小说 Codex 那样限定 Admin-only）。
4. **资源队列**：不接入现有 `resource_locks` 队列锁。理由：回测接口不调 LLM，单次请求几秒
   内完成，无跨请求共享状态，把它和狼人杀/小说共用一把锁只会造成不必要的互相抢占。
5. **代码归属**：并入 wolfgame 仓库（新目录 `server-bt/`），不留在独立的 autoT 目录里，
   保证和 Node 端服务同一套 git 历史、同一套部署流程、同一份 CLAUDE.md 上下文可查。
6. **与仓库里已存在但未上线的「股市」模块（`src/components/Stock/`，`/stock` 路由预留）
   保持独立**：那是实时看盘/纸上交易，数据源是第三方 WebSocket 实时行情；本工具是历史
   K 线回测，数据源是 akshare。两者目的和数据层都不同，本次不顺带把 Stock 模块接入路由。

## 前端设计

### 模块结构（仿 `src/modules/novel/`）

```
src/modules/backtest/
├── index.js            # ModuleDescriptor：id 'backtest'，路由 /backtest，home order 25
└── BacktestRoute.jsx    # 路由壳：懒加载页面组件，不包 QueueGate（决策 4）

src/components/
└── BacktestTool.jsx     # 主页面：左侧参数面板 + 右侧结果区，双栏布局仿 Dashboard.jsx
```

### 关键点

- **路由接入**：`paths.js` 加 `BACKTEST: '/backtest'`；`ModuleRegistry.js` 注册
  `backtest` 模块；`Dashboard.jsx` 功能按钮组加入口（图标用 `lucide-react` 的
  `LineChart`，紧跟"小说工作台"之后）。
- **UI 复刻映射**（Streamlit → React，逐项对应，不新增/不删减字段）：
  | Streamlit 控件 | React 对应 |
  |---|---|
  | `st.text_input`（股票代码） | `mac-input` |
  | `st.number_input`（持仓数量） | `mac-input type=number` |
  | `st.selectbox`（策略模板） | 自定义下拉或 `mac-` 风格 select |
  | `st.slider`（各类阈值参数） | HTML range input，套 mac 样式 |
  | `st.radio`（K线颗粒度） | 两个 `mac-button` 互斥切换 |
  | `st.line_chart` | 轻量 SVG 折线组件（同 `Stock/PriceLineChart.jsx` 手法，不引入图表库） |
  | `st.dataframe`（逐笔明细） | `mac-list-row` 列表或简单 table，`mac-panel` 包裹 |
  | `st.metric`（4 个汇总指标） | 4 个 `mac-panel` 小卡片网格，同 Dashboard 的 stat 卡片手感 |
  | `st.warning`/`st.info`/`st.error` | 对应 `text-warning`/`text-ink-muted`/`text-danger` 提示条 |
- **状态管理**：单组件内 `useState`（代码、数量、模板、参数、回测窗口选择、请求中/结果/
  错误状态），不需要新增 hook 或 reducer——这是一个单页表单+结果展示，不是复杂状态机。
- **免责声明文案原样保留**：「历史模拟结果，税前/费前，未考虑涨跌停等实际成交约束，不构成
  任何投资建议」等提示文字直接照搬 `app.py` 原文，逐字不改。

## 后端设计

### `server-bt/`（新 Python 微服务）

从 `app.py` 拆出纯函数层，去掉所有 `st.*` 调用：

```
server-bt/
├── main.py           # FastAPI app + 路由
├── data.py           # to_sina_symbol / fetch_daily / fetch_minute（原样迁移 + 内存 TTL 缓存替代 st.cache_data）
├── strategies.py      # sim_vwap_reversion / sim_gap_fade / sim_momentum_fade / _day_result（原样迁移）
├── backtest.py        # run_backtest（原样迁移）
└── requirements.txt   # akshare, pandas, numpy, fastapi, uvicorn
```

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查，返回 `{ok: true}` |
| `/daily-trend` | GET | Query: `code`。返回近120交易日买入持有累计涨跌幅序列（对应"日线趋势视图"分支） |
| `/backtest` | POST | Body: `{code, qty, positionPct, template, params}`。返回逐笔明细数组 + 汇总（累计盈亏、收益率、触发天数、盈利占比），对应 `run_backtest` 输出 |

- 缓存：`fetch_daily`/`fetch_minute` 用 `{key: (timestamp, df)}` 内存 dict，TTL 3600s，
  逻辑等价于原 `@st.cache_data(ttl=3600)`。
- 错误处理：akshare 请求失败时返回 4xx/5xx + 错误信息 JSON，前端映射回原来的
  `st.error(f"...获取失败：{e}")` 提示文案。
- 无鉴权：服务只信任来自 Worker 网关的请求（生产网络层面不直接对公网暴露），和
  `novelWorkspace.js` 里 `X-Zhaxiaoji-*` 头信任 Worker 的模式一致，但因为本工具不区分
  用户数据，不需要解析这些头。

### Worker 代理（`workers/auth/backtest.js`，仿 `novel.js`）

```js
export async function handleBacktestProxy(request, env, pathname) {
  // GET/POST 均公开（决策 3：Admin + Guest 都能用，无需鉴权分支）
  // 转发到 env.ECS_BACKTEST_URL + pathname.replace(/^\/api\/backtest/, '')
}
```

`workers/auth/index.js` 加一行路由：
```js
if (path.startsWith('/api/backtest/') && ['GET', 'POST'].includes(request.method)) {
  return handleBacktestProxy(request, env, path);
}
```

`wrangler.toml` `[vars]` 新增 `ECS_BACKTEST_URL`。

### 部署与网络（ECS 端）

- `server-bt/` 用 `uvicorn main:app --port 8001` 起，`pm2` 新增一条进程记录到
  `ecosystem.config.cjs`（interpreter 指向 venv 的 python，或系统 python3）。
- 现有 `ECS_NOVEL_URL`/`ECS_BT_URL` 都指向同一个域名 `novel-origin.zhaxiaoji.com`，
  实际是 Node `bt-server`（同一进程处理 `/bt/*` 和 `/novel/*`）。Python 服务是全新的
  第二个进程、新端口，因此 Worker 到它的出口需要一条新的可达路径。选择**复用同一个
  `novel-origin.zhaxiaoji.com` 域名，走 nginx 按路径转发**（如 `/backtest-api/* →
  127.0.0.1:8001`），而不是新开子域名——省掉新 DNS 记录和证书申请。`ECS_BACKTEST_URL`
  设为 `https://novel-origin.zhaxiaoji.com/backtest-api`。
  **实施时需要先读取 ECS 上现有 nginx 配置确认可行**（`novel-origin.zhaxiaoji.com` 当前
  的反代规则未知，可能需要新增一个 `location` 块）；如果该域名的 nginx 配置不便改动，
  退路是新开子域名 `backtest-origin.zhaxiaoji.com` 走一样的证书申请流程。这一步在
  implementation plan 里作为独立任务处理，不在本设计文档里预先假设结果。
- `check-build.mjs` 静态守门 + fingerprint check 流程照常执行（这两者只检查前端 bundle，
  和新增 Python 服务无关，不需要改造）。

## 不做的事（YAGNI）

- 不做用户级"我的回测历史"存储（D1 表），app.py 原本就没有持久化，本次照搬这个边界。
- 不做实时行情/自动交易——明确是历史回测 Demo，维持原范围。
- 不重构已有 `server/index.js`（Node bt-server），两个服务完全独立进程，互不感知。
