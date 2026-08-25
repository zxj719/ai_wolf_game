import pandas as pd
import pytest

from backtest import run_backtest, summarize


def _minute_df_two_days():
    day_a = pd.date_range("2024-01-02 09:35:00", periods=4, freq="5min")
    prices_a = [10.0, 10.0, 10.3, 9.9]
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
