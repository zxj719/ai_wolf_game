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
