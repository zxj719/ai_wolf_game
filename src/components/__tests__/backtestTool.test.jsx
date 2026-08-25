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
