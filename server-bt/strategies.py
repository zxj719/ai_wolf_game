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
