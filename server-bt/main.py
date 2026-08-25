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
