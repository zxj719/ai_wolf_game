// infoway.io 金融数据 API 配置
export const INFOWAY_CONFIG = {
  apiKey: 'c2c3f1594d41409e9e1a198b3e494d47-infoway',
  wsBase: 'wss://data.infoway.io/ws',
};

// WebSocket 协议码（infoway.io 私有协议，来源：官方 Python 示例）
export const WS_CODES = {
  TRADE_SUB:  10000,   // 订阅成交明细
  TRADE_ACK:  10001,   // 订阅确认
  TRADE_PUSH: 10002,   // 成交明细推送
  DEPTH_SUB:  10003,   // 订阅盘口（五档买卖）
  CANDLE_SUB: 10006,   // 订阅K线
  CANDLE_ACK: 10007,   // K线订阅确认
  CANDLE_PUSH:10008,   // K线数据推送
  HEARTBEAT:  10010,   // 心跳
};

// K线类型
export const CANDLE_TYPES = {
  MIN1: 1,
  MIN5: 2,
  MIN15: 3,
  MIN30: 4,
  MIN60: 5,
  DAY: 6,
  WEEK: 7,
  MONTH: 8,
};

export const MARKETS = [
  { value: 'stock', label: 'A股' },
  { value: 'crypto', label: '加密货币' },
  { value: 'common', label: '外汇/期货' },
];

// 默认自选 A 股列表（symbol 格式：代码.交易所）
export const DEFAULT_WATCHLIST = {
  stock: [
    { symbol: '600519.SH', name: '贵州茅台' },
    { symbol: '300750.SZ', name: '宁德时代' },
    { symbol: '002594.SZ', name: '比亚迪' },
    { symbol: '600036.SH', name: '招商银行' },
    { symbol: '601318.SH', name: '中国平安' },
    { symbol: '000858.SZ', name: '五粮液' },
  ],
  crypto: [
    { symbol: 'BTCUSDT', name: '比特币' },
    { symbol: 'ETHUSDT', name: '以太坊' },
  ],
  common: [
    { symbol: 'EURUSD', name: '欧元/美元' },
    { symbol: 'XAUUSD', name: '黄金' },
  ],
};
