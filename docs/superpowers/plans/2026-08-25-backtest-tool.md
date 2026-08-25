# 反向T策略回测工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `autoT/app.py`'s 反向T策略回测 Demo into zhaxiaoji.com as a homepage module (`/backtest`), rewriting the UI in React (mac visual style) while porting the Python计算/取数逻辑 unchanged into a new FastAPI microservice proxied by the existing Cloudflare Worker.

**Architecture:** New `server-bt/` FastAPI service on ECS (port 8001, pm2-managed) exposes `/health`, `/daily-trend`, `/run`. Worker route `/api/backtest/*` (public, no auth, no queue) proxies to it via `env.ECS_BACKTEST_URL`. New frontend module `src/modules/backtest/` + `src/components/BacktestTool.jsx` render the tool using existing `mac-*` Tailwind classes, registered in `ModuleRegistry.js` and linked from `Dashboard.jsx`.

**Tech Stack:** Python 3 + FastAPI + uvicorn + akshare + pandas (backend); React 18 + Tailwind (frontend, no new frontend deps); pytest (backend tests); vitest (frontend/worker tests, existing).

**Spec:** `docs/superpowers/specs/2026-08-25-backtest-tool-design.md`

## Global Constraints

- Visual style: only existing `mac-*` Tailwind classes (`mac-panel`, `mac-button`(+`-primary`/`-secondary`), `mac-input`, `mac-select`, `mac-textarea`, `mac-list-row`, `mac-window`, `mac-toolbar`, `mac-eyebrow`, `mac-icon-tile`) plus token colors (`text-ink`, `text-ink-muted`, `text-danger`, `text-warning`, `border-line`, `bg-bg-sunken`). No new CSS files, no new chart library.
- Access: Admin + Guest both allowed, `requiresAuth: false` on the route, no JWT check in the Worker proxy.
- No resource queue integration (no `QueueGate`, no `X-Lease-Id`).
- No D1 persistence — this feature has no database table.
- Python计算/取数逻辑（`to_sina_symbol`, `fetch_daily`, `fetch_minute`, `sim_vwap_reversion`, `sim_gap_fade`, `sim_momentum_fade`, `run_backtest`）ported byte-for-byte from `C:\Users\xingj\Documents\agent\autoT\app.py` — no algorithm changes.
- All user-facing disclaimer/warning copy from `app.py` reproduced verbatim in the React UI (character-for-character, not paraphrased).
- New code lives in the `wolfgame` repo: `server-bt/` (Python), `src/modules/backtest/` + `src/components/BacktestTool.jsx` (React), `workers/auth/backtest.js` (Worker).

---

## File Structure

```
server-bt/
├── requirements.txt
├── data.py            # to_sina_symbol, TTL cache, fetch_daily, fetch_minute
├── strategies.py       # _day_result, sim_vwap_reversion, sim_gap_fade, sim_momentum_fade
├── backtest.py         # run_backtest, summarize
├── main.py             # FastAPI app: /health, /daily-trend, /run
└── tests/
    ├── test_strategies.py
    ├── test_backtest.py
    └── test_main.py

workers/auth/
├── backtest.js          # handleBacktestProxy (new)
├── index.js              # + import + route registration (modified)
wrangler.toml              # + ECS_BACKTEST_URL var (modified)

src/shell/
├── paths.js               # + ROUTES.BACKTEST (modified)
├── ModuleRegistry.js       # + backtest module registered (modified)

src/modules/backtest/
├── index.js                # ModuleDescriptor
└── BacktestRoute.jsx        # route shell (lazy-loads BacktestTool)

src/services/
└── backtestService.js       # fetch wrapper for /api/backtest/*

src/components/
├── BacktestTool.jsx          # BacktestToolView (presentational) + BacktestTool (container)
└── __tests__/
    └── backtestTool.test.jsx

src/components/Dashboard.jsx  # + entry button (modified)
src/modules/home/HomeRoute.jsx # + onEnterBacktest wiring (modified)
ecosystem.config.cjs           # + backtest-server pm2 app (modified)
```

---

### Task 1: `server-bt/strategies.py` — 策略判定纯函数（原样迁移）

**Files:**
- Create: `server-bt/strategies.py`
- Test: `server-bt/tests/test_strategies.py`

**Interfaces:**
- Produces: `_day_result(day_df, sell_idx, buy_idx, forced) -> dict`, `sim_vwap_reversion(day_df, sell_threshold_pct, revert_threshold_pct) -> dict | None`, `sim_gap_fade(day_df, prev_close, gap_threshold_pct, fade_target_pct) -> dict | None`, `sim_momentum_fade(day_df, lookback_bars, momentum_threshold_pct, fade_threshold_pct) -> dict | None`. Each non-None dict has keys `sell_time, sell_price, buy_time, buy_price, forced_eod`.

- [ ] **Step 1: Write the failing tests**

```python
# server-bt/tests/test_strategies.py
import pandas as pd
import pytest

from strategies import sim_vwap_reversion, sim_gap_fade, sim_momentum_fade


def _flat_bars(prices, start="2024-01-02 09:35:00", volume=100):
    idx = pd.date_range(start, periods=len(prices), freq="5min")
    return pd.DataFrame({
        "day": idx,
        "open": prices,
        "high": prices,
        "low": prices,
        "close": prices,
        "volume": [volume] * len(prices),
    })


def test_vwap_reversion_triggers_and_reverts():
    day_df = _flat_bars([10.0, 10.0, 10.3, 9.9])
    result = sim_vwap_reversion(day_df, sell_threshold_pct=0.8, revert_threshold_pct=0.0)
    assert result is not None
    assert result["sell_price"] == pytest.approx(10.3)
    assert result["buy_price"] == pytest.approx(9.9)
    assert result["forced_eod"] is False


def test_vwap_reversion_forced_eod_when_no_revert():
    day_df = _flat_bars([10.0, 10.0, 10.3, 10.35])
    result = sim_vwap_reversion(day_df, sell_threshold_pct=0.8, revert_threshold_pct=0.0)
    assert result is not None
    assert result["sell_price"] == pytest.approx(10.3)
    assert result["buy_price"] == pytest.approx(10.35)
    assert result["forced_eod"] is True


def test_vwap_reversion_no_trigger_returns_none():
    day_df = _flat_bars([10.0, 10.0, 10.0, 10.0])
    assert sim_vwap_reversion(day_df, sell_threshold_pct=0.8, revert_threshold_pct=0.0) is None


def test_gap_fade_high_open_triggers():
    day_df = _flat_bars([10.2, 10.0])
    result = sim_gap_fade(day_df, prev_close=10.0, gap_threshold_pct=1.5, fade_target_pct=0.3)
    assert result is not None
    assert result["sell_price"] == pytest.approx(10.2)
    assert result["buy_price"] == pytest.approx(10.0)
    assert result["forced_eod"] is False


def test_gap_fade_no_gap_returns_none():
    day_df = _flat_bars([10.0, 10.0])
    assert sim_gap_fade(day_df, prev_close=10.0, gap_threshold_pct=1.5, fade_target_pct=0.3) is None


def test_momentum_fade_triggers():
    day_df = _flat_bars([10.0, 10.0, 10.15, 10.05, 10.02])
    result = sim_momentum_fade(
        day_df, lookback_bars=2, momentum_threshold_pct=1.0, fade_threshold_pct=0.2
    )
    assert result is not None
    assert result["sell_price"] == pytest.approx(10.15)
    assert result["buy_price"] == pytest.approx(10.02)
    assert result["forced_eod"] is False


def test_momentum_fade_no_trigger_returns_none():
    day_df = _flat_bars([10.0, 10.0, 10.05, 10.05])
    assert sim_momentum_fade(
        day_df, lookback_bars=2, momentum_threshold_pct=1.0, fade_threshold_pct=0.2
    ) is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server-bt && python -m pytest tests/test_strategies.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'strategies'`

- [ ] **Step 3: Write `strategies.py`** (ported verbatim from `C:\Users\xingj\Documents\agent\autoT\app.py` lines 51-134, Streamlit imports dropped — none of these functions used `st.*` in the original)

```python
# server-bt/strategies.py
"""策略模板：每个函数处理"一天"的分钟线，返回一次T的结果或 None。

原样迁移自 autoT/app.py（未改动任何判定逻辑），仅去除对 Streamlit 的隐式依赖
（原文件中这几个函数本就不直接调用 st.*）。
"""

import numpy as np
import pandas as pd


def _day_result(day_df: pd.DataFrame, sell_idx, buy_idx, forced: bool):
    sell_row = day_df.iloc[sell_idx]
    buy_row = day_df.iloc[buy_idx]
    return {
        "sell_time": sell_row["day"],
        "sell_price": float(sell_row["close"]),
        "buy_time": buy_row["day"],
        "buy_price": float(buy_row["close"]),
        "forced_eod": forced,
    }


def sim_vwap_reversion(day_df: pd.DataFrame, sell_threshold_pct: float, revert_threshold_pct: float):
    """价格相对当日VWAP偏离超过阈值 -> 卖；回落到buy阈值(或收盘强制) -> 买回。"""
    d = day_df.copy()
    d["typical"] = (d["high"] + d["low"] + d["close"]) / 3
    d["cum_pv"] = (d["typical"] * d["volume"]).cumsum()
    d["cum_v"] = d["volume"].cumsum().replace(0, np.nan)
    d["vwap"] = d["cum_pv"] / d["cum_v"]
    d["dev_pct"] = (d["close"] - d["vwap"]) / d["vwap"] * 100

    sell_idx = None
    for i in range(len(d)):
        if d["dev_pct"].iloc[i] >= sell_threshold_pct:
            sell_idx = i
            break
    if sell_idx is None:
        return None

    buy_idx = None
    for j in range(sell_idx + 1, len(d)):
        if d["dev_pct"].iloc[j] <= revert_threshold_pct:
            buy_idx = j
            break
    forced = buy_idx is None
    if forced:
        buy_idx = len(d) - 1
    if buy_idx <= sell_idx:
        return None
    return _day_result(d, sell_idx, buy_idx, forced)


def sim_gap_fade(day_df: pd.DataFrame, prev_close: float, gap_threshold_pct: float, fade_target_pct: float):
    """开盘跳空幅度超过阈值 -> 在开盘附近反向操作；缺口回补到目标位或收盘强制平仓。"""
    if prev_close is None or prev_close <= 0 or len(day_df) == 0:
        return None
    d = day_df.reset_index(drop=True)
    open_price = float(d["open"].iloc[0])
    gap_pct = (open_price - prev_close) / prev_close * 100

    if gap_pct >= gap_threshold_pct:
        sell_idx = 0
        target = prev_close * (1 + fade_target_pct / 100)
        buy_idx = None
        for j in range(1, len(d)):
            if d["close"].iloc[j] <= target:
                buy_idx = j
                break
        forced = buy_idx is None
        if forced:
            buy_idx = len(d) - 1
        if buy_idx <= sell_idx:
            return None
        return _day_result(d, sell_idx, buy_idx, forced)

    if gap_pct <= -gap_threshold_pct:
        buy_idx = 0
        target = prev_close * (1 - fade_target_pct / 100)
        sell_idx = None
        for j in range(1, len(d)):
            if d["close"].iloc[j] >= target:
                sell_idx = j
                break
        forced = sell_idx is None
        if forced:
            sell_idx = len(d) - 1
        if sell_idx <= buy_idx:
            return None
        return _day_result(d, sell_idx, buy_idx, forced)

    return None


def sim_momentum_fade(day_df: pd.DataFrame, lookback_bars: int, momentum_threshold_pct: float, fade_threshold_pct: float):
    """N根K线累计涨幅超过阈值 -> 卖；涨幅回落到fade阈值(或收盘强制) -> 买回。"""
    d = day_df.reset_index(drop=True)
    if len(d) <= lookback_bars:
        return None
    d["momentum_pct"] = d["close"].pct_change(lookback_bars) * 100

    sell_idx = None
    for i in range(lookback_bars, len(d)):
        if d["momentum_pct"].iloc[i] >= momentum_threshold_pct:
            sell_idx = i
            break
    if sell_idx is None:
        return None

    buy_idx = None
    for j in range(sell_idx + 1, len(d)):
        if d["momentum_pct"].iloc[j] <= fade_threshold_pct:
            buy_idx = j
            break
    forced = buy_idx is None
    if forced:
        buy_idx = len(d) - 1
    if buy_idx <= sell_idx:
        return None
    return _day_result(d, sell_idx, buy_idx, forced)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server-bt && python -m pytest tests/test_strategies.py -v`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add server-bt/strategies.py server-bt/tests/test_strategies.py
git commit -m "feat(backtest): port strategy simulation functions to FastAPI service"
```

---

### Task 2: `server-bt/backtest.py` — 回测主循环 + 汇总统计

**Files:**
- Create: `server-bt/backtest.py`
- Test: `server-bt/tests/test_backtest.py`

**Interfaces:**
- Consumes: `sim_vwap_reversion`, `sim_gap_fade`, `sim_momentum_fade` from `strategies.py` (Task 1).
- Produces: `run_backtest(minute_df, daily_df, qty, position_pct, template, params) -> pd.DataFrame` (columns: `日期,卖出价,买回价,股数,当日模拟盈亏(元),是否收盘强制平仓`). `summarize(trades_df, daily_df, qty) -> dict | None` — `None` when `trades_df` is empty; otherwise `{"trades": [ {date, sellPrice, buyPrice, shares, pnl, cumulativePnl, forcedEod}, ... ], "totalPnl": float, "returnPct": float, "triggeredDays": int, "winDaysPct": float}`.

- [ ] **Step 1: Write the failing tests**

```python
# server-bt/tests/test_backtest.py
import pandas as pd
import pytest

from backtest import run_backtest, summarize


def _minute_df_two_days():
    # Day A (2024-01-02): VWAP triggers sell@10.3 / buy@9.9 (see test_strategies.py fixture)
    day_a = pd.date_range("2024-01-02 09:35:00", periods=4, freq="5min")
    prices_a = [10.0, 10.0, 10.3, 9.9]
    # Day B (2024-01-03): flat, never triggers
    day_b = pd.date_range("2024-01-03 09:35:00", periods=4, freq="5min")
    prices_b = [10.0, 10.0, 10.0, 10.0]

    day_col = list(day_a) + list(day_b)
    price_col = prices_a + prices_b
    df = pd.DataFrame({
        "day": day_col,
        "open": price_col,
        "high": price_col,
        "low": price_col,
        "close": price_col,
        "volume": [100] * 8,
    })
    df["trade_date"] = df["day"].dt.date
    return df


def _daily_df_two_days():
    return pd.DataFrame({
        "date": pd.to_datetime(["2024-01-02", "2024-01-03"]),
        "close": [10.3, 10.0],
    })


def test_run_backtest_vwap_template_one_trigger_day():
    trades = run_backtest(
        _minute_df_two_days(), _daily_df_two_days(), qty=1000, position_pct=30,
        template="VWAP回归",
        params={"sell_threshold_pct": 0.8, "revert_threshold_pct": 0.0},
    )
    assert len(trades) == 1
    row = trades.iloc[0]
    assert row["卖出价"] == pytest.approx(10.3)
    assert row["买回价"] == pytest.approx(9.9)
    assert row["股数"] == 300
    assert row["当日模拟盈亏(元)"] == pytest.approx(120.0)
    assert row["是否收盘强制平仓"] == "否"


def test_run_backtest_unknown_template_returns_empty():
    trades = run_backtest(
        _minute_df_two_days(), _daily_df_two_days(), qty=1000, position_pct=30,
        template="不存在的模板", params={},
    )
    assert len(trades) == 0


def test_summarize_returns_none_for_empty_trades():
    empty = pd.DataFrame(columns=["日期", "卖出价", "买回价", "股数", "当日模拟盈亏(元)", "是否收盘强制平仓"])
    assert summarize(empty, _daily_df_two_days(), qty=1000) is None


def test_summarize_computes_metrics_and_cumulative_pnl():
    trades = run_backtest(
        _minute_df_two_days(), _daily_df_two_days(), qty=1000, position_pct=30,
        template="VWAP回归",
        params={"sell_threshold_pct": 0.8, "revert_threshold_pct": 0.0},
    )
    result = summarize(trades, _daily_df_two_days(), qty=1000)
    assert result is not None
    assert result["totalPnl"] == pytest.approx(120.0)
    assert result["returnPct"] == pytest.approx(1.2)
    assert result["triggeredDays"] == 1
    assert result["winDaysPct"] == pytest.approx(100.0)
    assert len(result["trades"]) == 1
    trade = result["trades"][0]
    assert trade["date"] == "2024-01-02"
    assert trade["sellPrice"] == pytest.approx(10.3)
    assert trade["buyPrice"] == pytest.approx(9.9)
    assert trade["shares"] == 300
    assert trade["pnl"] == pytest.approx(120.0)
    assert trade["cumulativePnl"] == pytest.approx(120.0)
    assert trade["forcedEod"] is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server-bt && python -m pytest tests/test_backtest.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'backtest'`

- [ ] **Step 3: Write `backtest.py`** (`run_backtest` ported verbatim from `app.py` lines 169-208; `summarize` is new — it's the JSON-shaping logic that used to live inline in the Streamlit UI section, lines 278-291)

```python
# server-bt/backtest.py
"""回测主循环（原样迁移自 autoT/app.py） + 汇总统计（新，取代原 Streamlit UI 里的内联计算）。"""

import pandas as pd

from strategies import sim_vwap_reversion, sim_gap_fade, sim_momentum_fade


def run_backtest(minute_df: pd.DataFrame, daily_df: pd.DataFrame, qty: int, position_pct: float,
                  template: str, params: dict):
    daily_close_by_date = dict(zip(daily_df["date"].dt.date, daily_df["close"]))
    trade_dates = sorted(minute_df["trade_date"].unique())

    rows = []
    for td in trade_dates:
        day_df = minute_df[minute_df["trade_date"] == td].reset_index(drop=True)
        if len(day_df) < 3:
            continue

        if template == "VWAP回归":
            result = sim_vwap_reversion(day_df, params["sell_threshold_pct"], params["revert_threshold_pct"])
        elif template == "开盘缺口回补":
            prev_dates = [d for d in daily_close_by_date if d < td]
            prev_close = daily_close_by_date.get(max(prev_dates)) if prev_dates else None
            result = sim_gap_fade(day_df, prev_close, params["gap_threshold_pct"], params["fade_target_pct"])
        elif template == "动量衰退":
            result = sim_momentum_fade(day_df, params["lookback_bars"], params["momentum_threshold_pct"],
                                        params["fade_threshold_pct"])
        else:
            result = None

        if result is None:
            continue

        shares = int(qty * position_pct / 100)
        if shares <= 0:
            continue
        pnl = shares * (result["sell_price"] - result["buy_price"])
        rows.append({
            "日期": td,
            "卖出价": round(result["sell_price"], 3),
            "买回价": round(result["buy_price"], 3),
            "股数": shares,
            "当日模拟盈亏(元)": round(pnl, 2),
            "是否收盘强制平仓": "是" if result["forced_eod"] else "否",
        })

    return pd.DataFrame(rows)


def summarize(trades_df: pd.DataFrame, daily_df: pd.DataFrame, qty: int) -> dict | None:
    """对应原 Streamlit UI 里 run 完 run_backtest 后的汇总代码块（app.py 271-294 行）。"""
    if trades_df is None or len(trades_df) == 0:
        return None

    trades_df = trades_df.sort_values("日期").reset_index(drop=True)
    trades_df["累计模拟盈亏(元)"] = trades_df["当日模拟盈亏(元)"].cumsum()

    ref_value = float(daily_df["close"].iloc[-1]) * qty
    total_pnl = float(trades_df["当日模拟盈亏(元)"].sum())
    win_days = int((trades_df["当日模拟盈亏(元)"] > 0).sum())
    total_days = int(len(trades_df))

    records = []
    for _, row in trades_df.iterrows():
        date_val = row["日期"]
        records.append({
            "date": date_val.isoformat() if hasattr(date_val, "isoformat") else str(date_val),
            "sellPrice": float(row["卖出价"]),
            "buyPrice": float(row["买回价"]),
            "shares": int(row["股数"]),
            "pnl": float(row["当日模拟盈亏(元)"]),
            "cumulativePnl": float(row["累计模拟盈亏(元)"]),
            "forcedEod": row["是否收盘强制平仓"] == "是",
        })

    return {
        "trades": records,
        "totalPnl": round(total_pnl, 2),
        "returnPct": round(total_pnl / ref_value * 100, 2) if ref_value else 0.0,
        "triggeredDays": total_days,
        "winDaysPct": round(win_days / total_days * 100, 2) if total_days else 0.0,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server-bt && python -m pytest tests/test_backtest.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add server-bt/backtest.py server-bt/tests/test_backtest.py
git commit -m "feat(backtest): port run_backtest loop and add JSON summarize()"
```

---

### Task 3: `server-bt/data.py` — 取数 + 前复权（原样迁移，TTL 缓存换掉 st.cache_data）

**Files:**
- Create: `server-bt/data.py`
- Test: `server-bt/tests/test_strategies.py` (add one function to same file — pure logic only; `fetch_daily`/`fetch_minute` hit the network and are verified manually in Task 11's deploy runbook, not unit-tested)

**Interfaces:**
- Produces: `to_sina_symbol(code: str) -> str`, `fetch_daily(code: str) -> pd.DataFrame`, `fetch_minute(code: str, period: str = "5") -> pd.DataFrame`.

- [ ] **Step 1: Write the failing test**

```python
# server-bt/tests/test_strategies.py  (append to the file created in Task 1)
from data import to_sina_symbol


def test_to_sina_symbol_prefixes_by_leading_digit():
    assert to_sina_symbol("600519") == "sh600519"
    assert to_sina_symbol("000001") == "sz000001"
    assert to_sina_symbol("sh600519") == "sh600519"
    assert to_sina_symbol(" 600519 ") == "sh600519"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server-bt && python -m pytest tests/test_strategies.py::test_to_sina_symbol_prefixes_by_leading_digit -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'data'`

- [ ] **Step 3: Write `data.py`** (`to_sina_symbol`/`fetch_daily`/`fetch_minute` bodies ported verbatim from `app.py` lines 20-43; `@st.cache_data(ttl=3600)` replaced with an equivalent-TTL in-process dict cache)

```python
# server-bt/data.py
"""数据获取（新浪数据源）。原样迁移自 autoT/app.py，@st.cache_data 换成等效 TTL 的内存缓存。"""

import time

import akshare as ak
import pandas as pd

_CACHE: dict[str, tuple[float, pd.DataFrame]] = {}
_CACHE_TTL_SECONDS = 3600


def to_sina_symbol(code: str) -> str:
    code = code.strip()
    if code.startswith(("sh", "sz")):
        return code
    if code.startswith("6"):
        return f"sh{code}"
    return f"sz{code}"


def _cached(key: str, loader):
    now = time.time()
    hit = _CACHE.get(key)
    if hit and now - hit[0] < _CACHE_TTL_SECONDS:
        return hit[1]
    df = loader()
    _CACHE[key] = (now, df)
    return df


def fetch_daily(code: str) -> pd.DataFrame:
    def _load():
        df = ak.stock_zh_a_daily(symbol=to_sina_symbol(code), adjust="qfq")
        df["date"] = pd.to_datetime(df["date"])
        return df.sort_values("date").reset_index(drop=True)

    return _cached(f"daily:{code}", _load)


def fetch_minute(code: str, period: str = "5") -> pd.DataFrame:
    def _load():
        df = ak.stock_zh_a_minute(symbol=to_sina_symbol(code), period=period, adjust="qfq")
        df["day"] = pd.to_datetime(df["day"])
        df["trade_date"] = df["day"].dt.date
        for col in ("open", "high", "low", "close", "volume", "amount"):
            df[col] = pd.to_numeric(df[col], errors="coerce")
        return df.dropna(subset=["open", "high", "low", "close"]).sort_values("day").reset_index(drop=True)

    return _cached(f"minute:{code}:{period}", _load)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server-bt && python -m pytest tests/test_strategies.py -v`
Expected: PASS (8 tests total in the file)

- [ ] **Step 5: Commit**

```bash
git add server-bt/data.py server-bt/tests/test_strategies.py
git commit -m "feat(backtest): port akshare data fetch layer with TTL cache"
```

---

### Task 4: `server-bt/main.py` — FastAPI 路由

**Files:**
- Create: `server-bt/main.py`
- Create: `server-bt/requirements.txt`
- Test: `server-bt/tests/test_main.py`

**Interfaces:**
- Consumes: `fetch_daily`, `fetch_minute` from `data.py` (Task 3); `run_backtest`, `summarize` from `backtest.py` (Task 2).
- Produces: FastAPI `app` with routes `GET /health`, `GET /daily-trend?code=`, `POST /run`.

- [ ] **Step 1: Write the failing tests**

```python
# server-bt/tests/test_main.py
import pandas as pd
import pytest
from fastapi.testclient import TestClient

import main


def _daily_df():
    dates = pd.date_range("2024-01-01", periods=121, freq="D")
    closes = [10.0 + 0.01 * i for i in range(121)]
    return pd.DataFrame({"date": dates, "close": closes})


def _minute_df_triggering():
    day = pd.date_range("2024-01-02 09:35:00", periods=4, freq="5min")
    prices = [10.0, 10.0, 10.3, 9.9]
    df = pd.DataFrame({
        "day": day, "open": prices, "high": prices, "low": prices, "close": prices,
        "volume": [100] * 4,
    })
    df["trade_date"] = df["day"].dt.date
    return df


@pytest.fixture
def client():
    return TestClient(main.app)


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_daily_trend(client, monkeypatch):
    monkeypatch.setattr(main, "fetch_daily", lambda code: _daily_df())
    resp = client.get("/daily-trend", params={"code": "000001"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == "000001"
    assert len(body["dates"]) == 120
    assert len(body["cumReturnPct"]) == 120
    assert body["cumReturnPct"][0] == 0.0


def test_daily_trend_fetch_failure_returns_502(client, monkeypatch):
    def _raise(code):
        raise RuntimeError("sina unreachable")
    monkeypatch.setattr(main, "fetch_daily", _raise)
    resp = client.get("/daily-trend", params={"code": "000001"})
    assert resp.status_code == 502
    assert "获取失败" in resp.json()["detail"]


def test_run_backtest_triggered(client, monkeypatch):
    monkeypatch.setattr(main, "fetch_daily", lambda code: _daily_df())
    monkeypatch.setattr(main, "fetch_minute", lambda code, period="5": _minute_df_triggering())
    resp = client.post("/run", json={
        "code": "000001",
        "qty": 1000,
        "positionPct": 30,
        "template": "VWAP回归",
        "params": {"sell_threshold_pct": 0.8, "revert_threshold_pct": 0.0},
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["triggered"] is True
    assert body["totalPnl"] == pytest.approx(120.0)
    assert len(body["trades"]) == 1


def test_run_backtest_not_triggered(client, monkeypatch):
    flat_df = _minute_df_triggering().copy()
    flat_df[["open", "high", "low", "close"]] = 10.0
    monkeypatch.setattr(main, "fetch_daily", lambda code: _daily_df())
    monkeypatch.setattr(main, "fetch_minute", lambda code, period="5": flat_df)
    resp = client.post("/run", json={
        "code": "000001",
        "qty": 1000,
        "positionPct": 30,
        "template": "VWAP回归",
        "params": {"sell_threshold_pct": 0.8, "revert_threshold_pct": 0.0},
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["triggered"] is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server-bt && python -m pytest tests/test_main.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'main'`

- [ ] **Step 3: Write `requirements.txt`**

```
akshare
pandas
numpy
fastapi
uvicorn[standard]
pytest
httpx
```

- [ ] **Step 4: Write `main.py`**

```python
# server-bt/main.py
"""反向T策略回测 — FastAPI 服务。

对应 autoT/app.py 的 Streamlit UI 分支（app.py 248-304 行），改成两个端点：
  GET  /daily-trend  — 对应"日线趋势视图"分支（app.py 257-263 行）
  POST /run           — 对应"分钟线 + 运行回测"分支（app.py 264-302 行）
只做历史回测，不生成实时结论，不执行交易、不接触任何券商账户。
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from backtest import run_backtest, summarize
from data import fetch_daily, fetch_minute

app = FastAPI(title="反向T策略回测")


class BacktestParams(BaseModel):
    sell_threshold_pct: float | None = None
    revert_threshold_pct: float | None = None
    gap_threshold_pct: float | None = None
    fade_target_pct: float | None = None
    lookback_bars: int | None = None
    momentum_threshold_pct: float | None = None
    fade_threshold_pct: float | None = None


class BacktestRequest(BaseModel):
    code: str
    qty: int
    positionPct: float
    template: str
    params: BacktestParams


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/daily-trend")
def daily_trend(code: str):
    try:
        daily_df = fetch_daily(code)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"日线数据获取失败：{e}")
    if daily_df is None or len(daily_df) == 0:
        raise HTTPException(status_code=404, detail="未获取到日线数据")

    window = daily_df.tail(120).copy()
    window["cum_return_pct"] = (window["close"] / window["close"].iloc[0] - 1) * 100
    return {
        "code": code,
        "dates": [d.strftime("%Y-%m-%d") for d in window["date"]],
        "cumReturnPct": [round(float(v), 4) for v in window["cum_return_pct"]],
    }


@app.post("/run")
def run(req: BacktestRequest):
    try:
        daily_df = fetch_daily(req.code)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"日线数据获取失败：{e}")
    if daily_df is None or len(daily_df) == 0:
        raise HTTPException(status_code=404, detail="未获取到日线数据")

    try:
        minute_df = fetch_minute(req.code)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"分钟线数据获取失败：{e}")
    if minute_df is None or len(minute_df) == 0:
        raise HTTPException(status_code=404, detail="未获取到分钟线数据")

    params_dict = req.params.model_dump(exclude_none=True)
    trades_df = run_backtest(minute_df, daily_df, req.qty, req.positionPct, req.template, params_dict)
    result = summarize(trades_df, daily_df, req.qty)
    if result is None:
        return {"ok": True, "triggered": False}
    return {"ok": True, "triggered": True, **result}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server-bt && python -m pytest tests/test_main.py -v`
Expected: PASS (5 tests)

- [ ] **Step 6: Run the full backend test suite**

Run: `cd server-bt && python -m pytest -v`
Expected: PASS (17 tests total across test_strategies.py, test_backtest.py, test_main.py)

- [ ] **Step 7: Commit**

```bash
git add server-bt/main.py server-bt/requirements.txt server-bt/tests/test_main.py
git commit -m "feat(backtest): add FastAPI routes for health/daily-trend/run"
```

---

### Task 5: `workers/auth/backtest.js` — Worker 代理

**Files:**
- Create: `workers/auth/backtest.js`
- Modify: `workers/auth/index.js:19` (import), `workers/auth/index.js:283` (route registration, right after the existing `handleNovelProxy` block)
- Modify: `wrangler.toml:45` (add `ECS_BACKTEST_URL` var, right after `ECS_NOVEL_URL`)

**Interfaces:**
- Produces: `handleBacktestProxy(request, env, pathname) -> Promise<Response>`.
- Consumes: `errorResponse`, `getCorsHeaders` from `./middleware.js` (already exist).

No dedicated unit test — `novel.js`'s `handleNovelProxy` (the pattern this mirrors) has no test file either, since the function body is a straight network passthrough with no branching business logic to isolate. Verified end-to-end in Task 11's deploy runbook via `curl`.

- [ ] **Step 1: Write `backtest.js`**

```js
// workers/auth/backtest.js
import { errorResponse, getCorsHeaders } from './middleware.js';

function resolveBacktestServiceBase(env) {
  const base = env.ECS_BACKTEST_URL;
  return base ? base.replace(/\/+$/, '') : '';
}

// Public endpoint (Admin + Guest, decision #3 in the design doc): pure historical
// computation, no per-user data, no LLM calls, no queue lock needed. See
// docs/superpowers/specs/2026-08-25-backtest-tool-design.md.
export async function handleBacktestProxy(request, env, pathname) {
  const base = resolveBacktestServiceBase(env);
  if (!base) {
    return errorResponse('Backtest service is not configured', 503, env, request);
  }

  const url = new URL(request.url);
  const upstreamPath = pathname.replace(/^\/api\/backtest/, '') || '/';
  const upstreamUrl = `${base}${upstreamPath}${url.search}`;
  const headers = new Headers();
  const contentType = request.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);
  headers.set('Accept', 'application/json');

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    });
    const text = await upstreamResponse.text();
    return new Response(text, {
      status: upstreamResponse.status,
      headers: {
        'Content-Type': upstreamResponse.headers.get('Content-Type') || 'application/json',
        ...getCorsHeaders(env, request),
      },
    });
  } catch (err) {
    console.error('[Backtest proxy]', err);
    return errorResponse('Backtest service unavailable: ' + err.message, 502, env, request);
  }
}
```

- [ ] **Step 2: Register the import in `workers/auth/index.js`**

Find (line 19):
```js
import { handleWerewolfSessionProxy } from './werewolf.js';
```
Replace with:
```js
import { handleWerewolfSessionProxy } from './werewolf.js';
import { handleBacktestProxy } from './backtest.js';
```

- [ ] **Step 3: Register the route in `workers/auth/index.js`**

Find (around line 285-287):
```js
      if (path.startsWith('/api/werewolf/session/') && request.method === 'POST') {
        return handleWerewolfSessionProxy(request, env, path);
      }
```
Insert immediately after:
```js

      if (path.startsWith('/api/backtest/') && ['GET', 'POST'].includes(request.method)) {
        return handleBacktestProxy(request, env, path);
      }
```

- [ ] **Step 4: Add the env var to `wrangler.toml`**

Find (line 45):
```toml
ECS_NOVEL_URL = "https://novel-origin.zhaxiaoji.com"
```
Insert immediately after:
```toml
# ECS 反向T回测 Python 微服务，走 novel-origin 的 nginx /backtest-api/ 路径转发（见部署 runbook）
ECS_BACKTEST_URL = "https://novel-origin.zhaxiaoji.com/backtest-api"
```

- [ ] **Step 5: Run the existing worker test suite to confirm nothing broke**

Run: `npm test -- workers/auth`
Expected: PASS (all existing `workers/auth/__tests__/*.test.js` unaffected)

- [ ] **Step 6: Commit**

```bash
git add workers/auth/backtest.js workers/auth/index.js wrangler.toml
git commit -m "feat(backtest): add Worker proxy route /api/backtest/*"
```

---

### Task 6: Frontend routing — `paths.js`, `ModuleRegistry.js`, `src/modules/backtest/`

**Files:**
- Modify: `src/shell/paths.js:28` (add `BACKTEST` route, right after `NOVEL`)
- Modify: `src/shell/ModuleRegistry.js:32,37` (import + register)
- Create: `src/modules/backtest/index.js`
- Create: `src/modules/backtest/BacktestRoute.jsx`

**Interfaces:**
- Consumes: `ROUTES` from `../../shell/paths` (existing), `useShell` from `../../shell/ShellContext` (existing).
- Produces: `ROUTES.BACKTEST = '/backtest'`; default-exported `backtestModule` ModuleDescriptor; default-exported `BacktestRoute` component that lazy-loads `BacktestTool` from `../../components/BacktestTool` (created in Task 8 — this task's `Suspense` fallback covers it until that file exists).

- [ ] **Step 1: Add the route constant**

In `src/shell/paths.js`, find:
```js
  NOVEL:  '/novel',
```
Replace with:
```js
  NOVEL:  '/novel',
  BACKTEST: '/backtest',
```

- [ ] **Step 2: Create the module descriptor**

```js
// src/modules/backtest/index.js
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
```

- [ ] **Step 3: Create the route shell**

```jsx
// src/modules/backtest/BacktestRoute.jsx
import { lazy, Suspense, useCallback } from 'react';
import { useShell } from '../../shell/ShellContext';
import { ROUTES } from '../../shell/paths';

const BacktestTool = lazy(() =>
  import('../../components/BacktestTool').then((m) => ({ default: m.BacktestTool }))
);

function Loader() {
  return (
    <div className="mac-app-shell flex min-h-screen items-center justify-center px-6">
      <div className="mac-window px-8 py-6 text-sm text-slate-500">Loading...</div>
    </div>
  );
}

export default function BacktestRoute() {
  const { navigate } = useShell();
  const onBack = useCallback(() => navigate(ROUTES.HOME), [navigate]);

  return (
    <div className="mac-app-shell">
      <Suspense fallback={<Loader />}>
        <BacktestTool onBack={onBack} />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 4: Register the module**

In `src/shell/ModuleRegistry.js`, find:
```js
import novel from '../modules/novel';
```
Replace with:
```js
import novel from '../modules/novel';
import backtest from '../modules/backtest';
```

Find:
```js
const modules = [home, auth, werewolf, novel, chat, tennis, robotics, chords, sites];
```
Replace with:
```js
const modules = [home, auth, werewolf, novel, backtest, chat, tennis, robotics, chords, sites];
```

- [ ] **Step 5: Commit**

```bash
git add src/shell/paths.js src/shell/ModuleRegistry.js src/modules/backtest/
git commit -m "feat(backtest): register /backtest route and module descriptor"
```

Note: this task alone leaves `../../components/BacktestTool` unresolved (created in Task 8). That's fine — the app still builds because the import is inside a `lazy()` call, only evaluated when the route is visited, and this route isn't linked from anywhere yet (Task 9 adds the link). `npm run build` will succeed after this task since no code path resolves the module eagerly. Confirm with:

Run: `npm run build`
Expected: build succeeds (the module isn't statically analyzable as broken until `BacktestTool.jsx` is imported eagerly, which never happens)

---

### Task 7: `src/services/backtestService.js` — API client

**Files:**
- Create: `src/services/backtestService.js`

**Interfaces:**
- Consumes: `buildApiUrl` from `./apiBase` (existing).
- Produces: `backtestService.fetchDailyTrend(code: string) -> Promise<{code, dates, cumReturnPct}>`, `backtestService.runBacktest({code, qty, positionPct, template, params}) -> Promise<{ok, triggered, trades?, totalPnl?, returnPct?, triggeredDays?, winDaysPct?}>`. Both throw `Error` with a Chinese message (from the API's `detail`/`error` field) on non-2xx.

- [ ] **Step 1: Write `backtestService.js`**

```js
// src/services/backtestService.js
import { buildApiUrl } from './apiBase';

async function parseJsonOrThrow(response) {
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // leave data null — fall through to the generic status-based message below
  }
  if (!response.ok) {
    const message = data?.detail || data?.error || `请求失败（${response.status}）`;
    throw new Error(message);
  }
  return data;
}

export const backtestService = {
  async fetchDailyTrend(code) {
    const response = await fetch(buildApiUrl(`/api/backtest/daily-trend?code=${encodeURIComponent(code)}`));
    return parseJsonOrThrow(response);
  },

  async runBacktest({ code, qty, positionPct, template, params }) {
    const response = await fetch(buildApiUrl('/api/backtest/run'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, qty, positionPct, template, params }),
    });
    return parseJsonOrThrow(response);
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/services/backtestService.js
git commit -m "feat(backtest): add API client for /api/backtest/*"
```

(No test file: this module is a thin `fetch` wrapper — its only branching logic, `parseJsonOrThrow`'s error-message fallback chain, is exercised indirectly by Task 8's component test via a stubbed `backtestService`. A dedicated test would need to mock global `fetch`, which the codebase's existing service files — e.g. `novelService.js` — don't do either.)

---

### Task 8: `src/components/BacktestTool.jsx` — 主页面

**Files:**
- Create: `src/components/BacktestTool.jsx`
- Test: `src/components/__tests__/backtestTool.test.jsx`

**Interfaces:**
- Consumes: `backtestService` from `../services/backtestService` (Task 7).
- Produces: `export function BacktestToolView({...})` (presentational, all state via props), `export function BacktestTool({ onBack })` (container: owns state, calls `backtestService`, renders `<BacktestToolView />`).

- [ ] **Step 1: Write the failing test**

```jsx
// src/components/__tests__/backtestTool.test.jsx
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { BacktestToolView } = await import('../BacktestTool.jsx');

const noop = () => {};

describe('BacktestToolView', () => {
  it('renders the initial idle state with default params', () => {
    const html = renderToStaticMarkup(
      <BacktestToolView
        code="000001"
        qty={1000}
        template="VWAP回归"
        params={{ sell_threshold_pct: 0.8, revert_threshold_pct: 0.0 }}
        periodChoice="minute"
        loading={false}
        error=""
        dailyTrend={null}
        result={null}
        onBack={noop}
        onChangeCode={noop}
        onChangeQty={noop}
        onChangeTemplate={noop}
        onChangeParam={noop}
        onChangePeriodChoice={noop}
        onRun={noop}
      />,
    );
    expect(html).toContain('反向T策略回测');
    expect(html).toContain('偏离VWAP多少%触发卖出');
    expect(html).toContain('左边选好股票、模板、参数，点「运行回测」看历史模拟结果。');
  });

  it('renders the no-trigger warning verbatim', () => {
    const html = renderToStaticMarkup(
      <BacktestToolView
        code="000001" qty={1000} template="VWAP回归"
        params={{ sell_threshold_pct: 0.8, revert_threshold_pct: 0.0 }}
        periodChoice="minute" loading={false} error=""
        dailyTrend={null}
        result={{ ok: true, triggered: false }}
        onBack={noop} onChangeCode={noop} onChangeQty={noop}
        onChangeTemplate={noop} onChangeParam={noop} onChangePeriodChoice={noop} onRun={noop}
      />,
    );
    expect(html).toContain('这组参数在近期数据里一次T都没触发——试试调低触发阈值，或换个波动更大的标的。');
  });

  it('renders trigger metrics and the trades table', () => {
    const html = renderToStaticMarkup(
      <BacktestToolView
        code="000001" qty={1000} template="VWAP回归"
        params={{ sell_threshold_pct: 0.8, revert_threshold_pct: 0.0 }}
        periodChoice="minute" loading={false} error=""
        dailyTrend={null}
        result={{
          ok: true, triggered: true, totalPnl: 120, returnPct: 1.2,
          triggeredDays: 1, winDaysPct: 100,
          trades: [{
            date: '2024-01-02', sellPrice: 10.3, buyPrice: 9.9, shares: 300,
            pnl: 120, cumulativePnl: 120, forcedEod: false,
          }],
        }}
        onBack={noop} onChangeCode={noop} onChangeQty={noop}
        onChangeTemplate={noop} onChangeParam={noop} onChangePeriodChoice={noop} onRun={noop}
      />,
    );
    expect(html).toContain('累计模拟盈亏');
    expect(html).toContain('2024-01-02');
    expect(html).toContain('历史模拟结果，税前/费前，未考虑涨跌停等实际成交约束，不构成任何投资建议。');
  });

  it('renders the fetch error banner', () => {
    const html = renderToStaticMarkup(
      <BacktestToolView
        code="000001" qty={1000} template="VWAP回归"
        params={{ sell_threshold_pct: 0.8, revert_threshold_pct: 0.0 }}
        periodChoice="minute" loading={false} error="分钟线数据获取失败：sina unreachable"
        dailyTrend={null} result={null}
        onBack={noop} onChangeCode={noop} onChangeQty={noop}
        onChangeTemplate={noop} onChangeParam={noop} onChangePeriodChoice={noop} onRun={noop}
      />,
    );
    expect(html).toContain('分钟线数据获取失败：sina unreachable');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- backtestTool`
Expected: FAIL — cannot resolve `../BacktestTool.jsx`

- [ ] **Step 3: Write `BacktestTool.jsx`**

```jsx
// src/components/BacktestTool.jsx
import React, { useCallback, useMemo, useState } from 'react';
import { ChevronLeft, LineChart, Loader2 } from 'lucide-react';
import { backtestService } from '../services/backtestService';

const TEMPLATES = ['VWAP回归', '开盘缺口回补', '动量衰退'];

const PARAM_CONFIG = {
  'VWAP回归': [
    { key: 'sell_threshold_pct', label: '偏离VWAP多少%触发卖出', min: 0.2, max: 3.0, step: 0.1, default: 0.8 },
    { key: 'revert_threshold_pct', label: '回落到VWAP以下多少%买回', min: -1.0, max: 0.5, step: 0.1, default: 0.0 },
  ],
  '开盘缺口回补': [
    { key: 'gap_threshold_pct', label: '跳空幅度阈值 (%)', min: 0.5, max: 5.0, step: 0.1, default: 1.5 },
    { key: 'fade_target_pct', label: '缺口回补目标 (相对昨收 %)', min: 0.0, max: 2.0, step: 0.1, default: 0.3 },
  ],
  '动量衰退': [
    { key: 'lookback_bars', label: '动量回看K线根数', min: 2, max: 24, step: 1, default: 6 },
    { key: 'momentum_threshold_pct', label: '触发卖出的累计涨幅 (%)', min: 0.3, max: 3.0, step: 0.1, default: 1.0 },
    { key: 'fade_threshold_pct', label: '回落到多少%买回', min: -1.0, max: 1.0, step: 0.1, default: 0.2 },
  ],
};

export function defaultParamsFor(template) {
  const config = PARAM_CONFIG[template] || [];
  return Object.fromEntries(config.map((p) => [p.key, p.default]));
}

function MiniLineChart({ values, height = 200 }) {
  if (!values || values.length < 2) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-ink-faint text-sm">
        暂无数据
      </div>
    );
  }
  const width = 800;
  const pad = { top: 12, right: 12, bottom: 12, left: 12 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const toX = (i) => pad.left + (i / (values.length - 1)) * chartW;
  const toY = (v) => pad.top + (1 - (v - min) / range) * chartH;
  const isUp = values[values.length - 1] >= values[0];
  const color = isUp ? 'var(--market-up)' : 'var(--market-down)';
  const linePath = values.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const areaPath = `M${toX(0).toFixed(1)},${toY(values[0]).toFixed(1)} ` +
    values.map((v, i) => `L${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ') +
    ` L${toX(values.length - 1).toFixed(1)},${pad.top + chartH} L${toX(0).toFixed(1)},${pad.top + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="btGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#btGrad)" />
      <polyline points={linePath} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BacktestToolView({
  code, qty, template, params, periodChoice,
  loading, error, dailyTrend, result,
  onBack, onChangeCode, onChangeQty, onChangeTemplate, onChangeParam, onChangePeriodChoice, onRun,
}) {
  const paramConfig = PARAM_CONFIG[template] || [];

  return (
    <div className="px-4 py-16 md:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mac-window">
          <div className="mac-toolbar rounded-t-[24px]">
            <div className="flex items-center gap-4">
              <div className="mac-window-chrome">
                <span className="mac-window-dot mac-dot-red" />
                <span className="mac-window-dot mac-dot-yellow" />
                <span className="mac-window-dot mac-dot-green" />
              </div>
              <div>
                <div className="mac-eyebrow">Zhaxiaoji Studio</div>
                <h1 className="text-base font-semibold text-ink">反向T策略回测</h1>
              </div>
            </div>
            <button type="button" onClick={onBack} className="mac-button mac-button-secondary">
              <ChevronLeft size={15} />
              返回
            </button>
          </div>

          <p className="px-6 pt-4 text-sm text-ink-muted md:px-8">
            对应设计文档 Approach A —— 预设模板 + 参数滑块，纯历史回测，不生成实时结论
          </p>

          <main className="grid gap-8 px-6 py-8 lg:grid-cols-[1fr_1.4fr] lg:px-8">
            <section className="space-y-5">
              <div className="mac-panel p-5 space-y-4">
                <div className="mac-eyebrow">持仓</div>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-ink">股票代码（6位，如 000001 / 600519）</span>
                  <input
                    type="text"
                    className="mac-input"
                    value={code}
                    onChange={(e) => onChangeCode(e.target.value)}
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-ink">持仓数量（股）</span>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    className="mac-input"
                    value={qty}
                    onChange={(e) => onChangeQty(Number(e.target.value))}
                  />
                </label>
              </div>

              <div className="mac-panel p-5 space-y-4">
                <div className="mac-eyebrow">策略模板</div>
                <select
                  className="mac-select"
                  value={template}
                  onChange={(e) => onChangeTemplate(e.target.value)}
                >
                  {TEMPLATES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                <div className="mac-eyebrow pt-2">参数</div>
                {paramConfig.map((p) => (
                  <label key={p.key} className="block space-y-1.5">
                    <span className="text-sm text-ink-muted">
                      {p.label}：<span className="font-medium text-ink">{params[p.key]}</span>
                    </span>
                    <input
                      type="range"
                      className="w-full accent-amber-600"
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      value={params[p.key] ?? p.default}
                      onChange={(e) => onChangeParam(p.key, Number(e.target.value))}
                    />
                  </label>
                ))}
              </div>

              <div className="mac-panel p-5 space-y-4">
                <div className="mac-eyebrow">回测窗口</div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => onChangePeriodChoice('daily')}
                    className={`mac-button justify-start ${periodChoice === 'daily' ? 'mac-button-primary' : 'mac-button-secondary'}`}
                  >
                    日线（60-120天趋势）
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangePeriodChoice('minute')}
                    className={`mac-button justify-start ${periodChoice === 'minute' ? 'mac-button-primary' : 'mac-button-secondary'}`}
                  >
                    5分钟线（近约40个交易日，用于日内信号）
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onRun}
                  disabled={loading}
                  className="mac-button mac-button-primary w-full"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <LineChart size={16} />}
                  运行回测
                </button>
              </div>
            </section>

            <section className="space-y-4">
              {loading && (
                <div className="mac-panel p-5 flex items-center gap-2 text-sm text-ink-muted">
                  <Loader2 size={16} className="animate-spin" />
                  处理中...
                </div>
              )}

              {!loading && error && (
                <div className="rounded-[18px] border border-danger bg-danger-soft px-4 py-3 text-sm leading-6 text-danger">
                  {error}
                </div>
              )}

              {!loading && !error && periodChoice === 'daily' && dailyTrend && (
                <div className="mac-panel p-5 space-y-4">
                  <h2 className="text-base font-semibold text-ink">
                    {dailyTrend.code} 近{dailyTrend.dates.length}个交易日 —— 买入持有累计涨跌幅
                  </h2>
                  <MiniLineChart values={dailyTrend.cumReturnPct} />
                  <div className="rounded-[18px] border border-line bg-bg-sunken px-4 py-3 text-sm leading-6 text-ink-muted">
                    当前选择的是日线趋势视图，仅展示买入持有的涨跌幅走势；切换到分钟线视图可以运行反向T策略回测。
                  </div>
                </div>
              )}

              {!loading && !error && periodChoice === 'minute' && result && !result.triggered && (
                <div className="rounded-[18px] border border-warning bg-warning-soft px-4 py-3 text-sm leading-6 text-warning">
                  这组参数在近期数据里一次T都没触发——试试调低触发阈值，或换个波动更大的标的。
                </div>
              )}

              {!loading && !error && periodChoice === 'minute' && result && result.triggered && (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="mac-panel p-4">
                      <div className="text-xs text-ink-faint">累计模拟盈亏</div>
                      <div className="mt-1 text-lg font-semibold text-ink">
                        ¥{Math.round(result.totalPnl).toLocaleString()}
                      </div>
                    </div>
                    <div className="mac-panel p-4">
                      <div className="text-xs text-ink-faint">模拟收益率</div>
                      <div className="mt-1 text-lg font-semibold text-ink">{result.returnPct.toFixed(2)}%</div>
                    </div>
                    <div className="mac-panel p-4">
                      <div className="text-xs text-ink-faint">触发T的交易日数</div>
                      <div className="mt-1 text-lg font-semibold text-ink">{result.triggeredDays}</div>
                    </div>
                    <div className="mac-panel p-4">
                      <div className="text-xs text-ink-faint">当日盈利占比</div>
                      <div className="mt-1 text-lg font-semibold text-ink">{Math.round(result.winDaysPct)}%</div>
                    </div>
                  </div>

                  <div className="mac-panel p-5 space-y-3">
                    <h3 className="text-sm font-semibold text-ink">累计模拟盈亏走势</h3>
                    <MiniLineChart values={result.trades.map((t) => t.cumulativePnl)} />
                  </div>

                  <div className="mac-panel p-5 space-y-3 overflow-x-auto">
                    <h3 className="text-sm font-semibold text-ink">逐笔明细</h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-ink-faint">
                          <th className="py-1.5 pr-3 font-medium">日期</th>
                          <th className="py-1.5 pr-3 font-medium">卖出价</th>
                          <th className="py-1.5 pr-3 font-medium">买回价</th>
                          <th className="py-1.5 pr-3 font-medium">股数</th>
                          <th className="py-1.5 pr-3 font-medium">当日模拟盈亏(元)</th>
                          <th className="py-1.5 pr-3 font-medium">累计模拟盈亏(元)</th>
                          <th className="py-1.5 pr-3 font-medium">是否收盘强制平仓</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {result.trades.map((t) => (
                          <tr key={t.date}>
                            <td className="py-1.5 pr-3 text-ink">{t.date}</td>
                            <td className="py-1.5 pr-3 text-ink">{t.sellPrice}</td>
                            <td className="py-1.5 pr-3 text-ink">{t.buyPrice}</td>
                            <td className="py-1.5 pr-3 text-ink">{t.shares}</td>
                            <td className="py-1.5 pr-3 text-ink">{t.pnl}</td>
                            <td className="py-1.5 pr-3 text-ink">{t.cumulativePnl}</td>
                            <td className="py-1.5 pr-3 text-ink">{t.forcedEod ? '是' : '否'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-xs leading-6 text-ink-faint">
                    历史模拟结果，税前/费前，未考虑涨跌停等实际成交约束，不构成任何投资建议。
                    「收盘强制平仓」表示当天没等到反向信号，按收盘价强制买回以保持底仓不变。
                  </p>
                </>
              )}

              {!loading && !error && !dailyTrend && !result && (
                <div className="rounded-[18px] border border-line bg-bg-sunken px-4 py-3 text-sm leading-6 text-ink-muted">
                  左边选好股票、模板、参数，点「运行回测」看历史模拟结果。
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

export function BacktestTool({ onBack }) {
  const [code, setCode] = useState('000001');
  const [qty, setQty] = useState(1000);
  const [template, setTemplate] = useState('VWAP回归');
  const [params, setParams] = useState(() => defaultParamsFor('VWAP回归'));
  const [positionPct] = useState(30);
  const [periodChoice, setPeriodChoice] = useState('minute');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dailyTrend, setDailyTrend] = useState(null);
  const [result, setResult] = useState(null);

  const handleChangeTemplate = useCallback((nextTemplate) => {
    setTemplate(nextTemplate);
    setParams(defaultParamsFor(nextTemplate));
  }, []);

  const handleChangeParam = useCallback((key, value) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleRun = useCallback(async () => {
    setError('');
    setLoading(true);
    setResult(null);
    setDailyTrend(null);
    try {
      if (periodChoice === 'daily') {
        const data = await backtestService.fetchDailyTrend(code);
        setDailyTrend(data);
      } else {
        const data = await backtestService.runBacktest({ code, qty, positionPct, template, params });
        setResult(data);
      }
    } catch (err) {
      setError(err.message || '请求失败');
    } finally {
      setLoading(false);
    }
  }, [code, qty, positionPct, template, params, periodChoice]);

  return (
    <BacktestToolView
      code={code}
      qty={qty}
      template={template}
      params={params}
      periodChoice={periodChoice}
      loading={loading}
      error={error}
      dailyTrend={dailyTrend}
      result={result}
      onBack={onBack}
      onChangeCode={setCode}
      onChangeQty={setQty}
      onChangeTemplate={handleChangeTemplate}
      onChangeParam={handleChangeParam}
      onChangePeriodChoice={setPeriodChoice}
      onRun={handleRun}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- backtestTool`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/BacktestTool.jsx src/components/__tests__/backtestTool.test.jsx
git commit -m "feat(backtest): add BacktestTool page (view + container)"
```

---

### Task 9: Homepage entry — `Dashboard.jsx` + `HomeRoute.jsx`

**Files:**
- Modify: `src/components/Dashboard.jsx:6-24` (icon import), `:50-64` (props), `:228-231` (button)
- Modify: `src/modules/home/HomeRoute.jsx:40` (callback), `:61-76` (prop passthrough)

**Interfaces:**
- Consumes: `ROUTES.BACKTEST` (Task 6).

- [ ] **Step 1: Import the icon in `Dashboard.jsx`**

Find:
```js
  Key,
  LogIn,
```
Replace with:
```js
  Key,
  LineChart,
  LogIn,
```

- [ ] **Step 2: Accept the new prop**

Find:
```js
export function Dashboard({
  onEnterWolfgame,
  onEnterSites,
  onEnterChords,
  onEnterTennis,
  onEnterRobotics,
  onEnterNovel,
  onEnterChat,
```
Replace with:
```js
export function Dashboard({
  onEnterWolfgame,
  onEnterSites,
  onEnterChords,
  onEnterTennis,
  onEnterRobotics,
  onEnterNovel,
  onEnterBacktest,
  onEnterChat,
```

- [ ] **Step 3: Add the button**

Find:
```jsx
                <button type="button" onClick={onEnterNovel} className="mac-button mac-button-secondary">
                  <PenLine size={16} />
                  小说工作台
                </button>
```
Insert immediately after:
```jsx
                <button type="button" onClick={onEnterBacktest} className="mac-button mac-button-secondary">
                  <LineChart size={16} />
                  反向T回测
                </button>
```

- [ ] **Step 4: Wire it in `HomeRoute.jsx`**

Find:
```js
  const onEnterNovel = useCallback(() => navigate(ROUTES.NOVEL), [navigate]);
```
Replace with:
```js
  const onEnterNovel = useCallback(() => navigate(ROUTES.NOVEL), [navigate]);
  const onEnterBacktest = useCallback(() => navigate(ROUTES.BACKTEST), [navigate]);
```

Find:
```jsx
          onEnterNovel={onEnterNovel}
```
Replace with:
```jsx
          onEnterNovel={onEnterNovel}
          onEnterBacktest={onEnterBacktest}
```

- [ ] **Step 5: Run the existing Dashboard/home tests to confirm nothing broke**

Run: `npm test -- localizedScreens startFlow`
Expected: PASS (existing suites covering Dashboard/home rendering unaffected — the new button doesn't change any assertion they make)

- [ ] **Step 6: Commit**

```bash
git add src/components/Dashboard.jsx src/modules/home/HomeRoute.jsx
git commit -m "feat(backtest): add homepage entry for 反向T回测"
```

---

### Task 10: Full frontend build + lint gate

**Files:** none (verification-only task)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS (all existing tests + Task 8's new `backtestTool.test.jsx`)

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS, 0 warnings

- [ ] **Step 3: Run the production build (includes `scripts/check-build.mjs` static gate)**

Run: `npm run build`
Expected: PASS — `dist/` produced, `check-build.mjs` finds no `localhost`/`127.0.0.1`/dev markers in the new `BacktestTool`/`backtestService` chunks

- [ ] **Step 4: Commit (only if any of the above required fixes)**

```bash
git add -A
git commit -m "fix(backtest): address lint/build issues surfaced by the full gate"
```
(Skip this step entirely if steps 1-3 all passed clean with no changes needed.)

---

### Task 11: ECS 部署 — Python 服务 + nginx + pm2 (runbook, not TDD)

This task provisions live infrastructure. Unlike Tasks 1-9 it isn't red/green — each
step is an operational action with a concrete verification command. Requires root SSH
to the ECS box (47.111.227.91).

**Files:**
- Modify: `ecosystem.config.cjs` (add the `backtest-server` pm2 app)

- [ ] **Step 1: Add the pm2 app entry**

In `ecosystem.config.cjs`, find:
```js
  apps: [
    {
      name: 'bt-server',
```
Replace with:
```js
  apps: [
    {
      name: 'backtest-server',
      script: './venv/bin/uvicorn',
      args: 'main:app --host 127.0.0.1 --port 8001',
      interpreter: 'none',
      cwd: '/var/www/wolfgame/server-bt',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      out_file: '/var/log/wolfgame/backtest-server-out.log',
      error_file: '/var/log/wolfgame/backtest-server-err.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'bt-server',
```
(the existing `bt-server` block and its closing keeps everything after unchanged — this only inserts a new array element before it)

- [ ] **Step 2: Commit the pm2 config change**

```bash
git add ecosystem.config.cjs
git commit -m "chore(backtest): register backtest-server in pm2 ecosystem config"
```

- [ ] **Step 3: Deploy the code to ECS and set up the Python venv**

SSH to `47.111.227.91` as root, then:
```bash
cd /var/www/wolfgame && git pull
cd /var/www/wolfgame/server-bt
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
```
Verify: `./venv/bin/python -c "import fastapi, akshare; print('ok')"` prints `ok`.

- [ ] **Step 4: Start the service under pm2**

```bash
cd /var/www/wolfgame
pm2 start ecosystem.config.cjs --only backtest-server
pm2 save
```
Verify: `curl -s http://127.0.0.1:8001/health` returns `{"ok":true}`.

- [ ] **Step 5: Locate the existing nginx config for `novel-origin.zhaxiaoji.com` and add a path-based proxy**

```bash
grep -rl "novel-origin.zhaxiaoji.com" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null
```
Open the matching file. Inside its `server { ... }` block (alongside the existing
`location /` that proxies to the Node `bt-server`), add:
```nginx
    location /backtest-api/ {
        proxy_pass http://127.0.0.1:8001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
```
Then:
```bash
nginx -t && systemctl reload nginx
```

**Fallback if that config file can't be found or safely edited** (e.g. `novel-origin.zhaxiaoji.com` turns out to be a Cloudflare-proxied DNS record with no local nginx vhost): provision a new subdomain `backtest-origin.zhaxiaoji.com` pointed at the same box with its own nginx server block + TLS cert (same process used for `novel-origin.zhaxiaoji.com`, mirror that record's setup), and set `ECS_BACKTEST_URL = "https://backtest-origin.zhaxiaoji.com"` (no `/backtest-api` suffix) in Task 5's `wrangler.toml` change instead.

Verify: `curl -s https://novel-origin.zhaxiaoji.com/backtest-api/health` (or the fallback URL) returns `{"ok":true}`.

- [ ] **Step 6: Deploy the Worker + frontend**

From the local machine (not ECS):
```bash
npm run deploy
```

- [ ] **Step 7: Fingerprint-check the deploy**

Per `CLAUDE.md`'s deploy verification rules — walk the lazy-chunk chain (`index` →
`ModuleRegistry`/`BacktestRoute` → `BacktestTool`) rather than grepping the entry
chunk directly:
```bash
ENTRY=$(curl -s "https://zhaxiaoji.com/?nocache=$(date +%s)" | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1)
curl -s "https://zhaxiaoji.com/$ENTRY" | grep -oE 'BacktestTool-[A-Za-z0-9_-]+\.js' | head -1
```
Confirm a `BacktestTool-*.js` chunk name is found (proves the module made it into the
deployed bundle), then:
```bash
curl -s "https://zhaxiaoji.com/assets/<that-chunk-name>" | grep -c "localhost\|127.0.0.1"
```
Expected: `0`.

- [ ] **Step 8: End-to-end smoke test via curl**

```bash
curl -s -X POST https://zhaxiaoji.com/api/backtest/run \
  -H "Content-Type: application/json" \
  -d '{"code":"000001","qty":1000,"positionPct":30,"template":"VWAP回归","params":{"sell_threshold_pct":0.8,"revert_threshold_pct":0.0}}'
```
Expected: JSON with `"ok": true` and either `"triggered": false` or a populated
`trades` array — not a 502/503 (which would indicate the nginx path or
`ECS_BACKTEST_URL` is misconfigured).

- [ ] **Step 9: Manual browser check**

Open `https://zhaxiaoji.com/backtest`, confirm the page renders in mac style, run a
backtest for `000001`, confirm results render and the disclaimer text is present.

---

## Self-Review Notes

- **Spec coverage:** all 6 "已确认决策" items map to tasks — (1) React rewrite → Tasks 6/8; (2) Python microservice → Tasks 1-4; (3) Admin+Guest access → Task 5/6 (`requiresAuth: false`, no auth check in proxy); (4) no queue → Task 6 (no `QueueGate`); (5) code in `wolfgame` repo → all `server-bt/` tasks; (6) Stock module left alone → no task touches `src/components/Stock/`.
- **Type consistency checked:** `run_backtest(minute_df, daily_df, qty, position_pct, template, params)` signature is identical across Task 2's definition, Task 2's tests, and Task 4's call site. `summarize(trades_df, daily_df, qty)` likewise. Frontend: `BacktestToolView` prop names match 1:1 between Task 8's component and its test; `backtestService.fetchDailyTrend`/`runBacktest` names match between Task 7 and Task 8's container.
- **No placeholders:** every step has literal code, not descriptions of code.
