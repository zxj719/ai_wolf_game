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
