import React, { useCallback, useState } from 'react';
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
