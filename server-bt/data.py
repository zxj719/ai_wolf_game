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
