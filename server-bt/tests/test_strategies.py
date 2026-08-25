import pandas as pd
import pytest

from strategies import sim_vwap_reversion, sim_gap_fade, sim_momentum_fade
from data import to_sina_symbol


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


def test_to_sina_symbol_prefixes_by_leading_digit():
    assert to_sina_symbol("600519") == "sh600519"
    assert to_sina_symbol("000001") == "sz000001"
    assert to_sina_symbol("sh600519") == "sh600519"
    assert to_sina_symbol(" 600519 ") == "sh600519"
