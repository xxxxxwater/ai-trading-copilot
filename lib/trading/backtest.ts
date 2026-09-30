import type {
  BacktestConfig,
  BacktestExitReason,
  BacktestResult,
  BacktestTrade,
  EquityPoint,
  MarketCandle,
  StrategyIR,
} from './types';

function rsiPoint(avgGain: number, avgLoss: number): number {
  if (avgGain === 0 && avgLoss === 0) return 50;
  if (avgLoss === 0) return 100;
  if (avgGain === 0) return 0;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function rsi(values: number[], period: number): Array<number | null> {
  const output: Array<number | null> = Array(values.length).fill(null);
  if (values.length <= period) return output;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = values[i] - values[i - 1];
    gains += Math.max(change, 0);
    losses += Math.max(-change, 0);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  output[period] = rsiPoint(avgGain, avgLoss);

  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    output[i] = rsiPoint(avgGain, avgLoss);
  }

  return output;
}

function numberFromRule(ir: StrategyIR, side: 'entry' | 'exit', fallback: number): number {
  const rules = side === 'entry' ? ir.entries : ir.exits;
  const rsiRule = rules.find((rule) => rule.expression.toUpperCase().includes('RSI'));
  const match = rsiRule?.expression.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : fallback;
}

function deriveConfig(ir: StrategyIR, overrides: Partial<BacktestConfig> = {}): BacktestConfig {
  const rsiIndicator = ir.indicators.find((indicator) => indicator.name === 'RSI');
  const period = Number(rsiIndicator?.params.period ?? 14);

  return {
    initialCapital: overrides.initialCapital ?? 10_000,
    feeBps: overrides.feeBps ?? ir.execution.feeBps ?? 4,
    slippageBps: overrides.slippageBps ?? ir.execution.slippageBps ?? 2,
    rsiPeriod: overrides.rsiPeriod ?? (Number.isFinite(period) ? period : 14),
    longEntryRsi: overrides.longEntryRsi ?? numberFromRule(ir, 'entry', 30),
    longExitRsi: overrides.longExitRsi ?? numberFromRule(ir, 'exit', 70),
    positionFraction: overrides.positionFraction ?? Math.min(1, Math.max(0.01, (ir.risk.maxPositionPct ?? 100) / 100)),
    stopLossPct: overrides.stopLossPct ?? ir.risk.stopLossPct,
    takeProfitPct: overrides.takeProfitPct ?? ir.risk.takeProfitPct,
    executionTiming: 'signal-close-next-open',
    intrabarCollision: 'stop-first',
  };
}

function validateConfig(config: BacktestConfig): void {
  const bounded = [
    ['initialCapital', config.initialCapital, 0, Number.POSITIVE_INFINITY],
    ['feeBps', config.feeBps, 0, 10_000],
    ['slippageBps', config.slippageBps, 0, 10_000],
    ['rsiPeriod', config.rsiPeriod, 2, 10_000],
    ['longEntryRsi', config.longEntryRsi, 0, 100],
    ['longExitRsi', config.longExitRsi, 0, 100],
    ['positionFraction', config.positionFraction, Number.EPSILON, 1],
  ] as const;

  for (const [name, value, min, max] of bounded) {
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new Error(`Invalid backtest configuration: ${name}=${value}`);
    }
  }

  for (const [name, value] of [['stopLossPct', config.stopLossPct], ['takeProfitPct', config.takeProfitPct]] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0 || value >= 100)) {
      throw new Error(`Invalid backtest configuration: ${name}=${value}`);
    }
  }

  if (config.longEntryRsi >= config.longExitRsi) {
    throw new Error('RSI entry threshold must be lower than exit threshold.');
  }
}

function validateCandles(candles: MarketCandle[]): void {
  if (candles.length < 30) throw new Error('At least 30 candles are required for backtesting.');

  candles.forEach((candle, index) => {
    const values = [
      candle.openTime,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume,
      candle.closeTime,
    ];

    if (values.some((value) => !Number.isFinite(value))) {
      throw new Error(`Invalid candle at index ${index}: all fields must be finite numbers.`);
    }
    if (candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0 || candle.volume < 0) {
      throw new Error(`Invalid candle at index ${index}: prices must be positive and volume non-negative.`);
    }
    if (candle.openTime >= candle.closeTime) {
      throw new Error(`Invalid candle at index ${index}: openTime must be before closeTime.`);
    }
    if (candle.high < Math.max(candle.open, candle.close, candle.low) || candle.low > Math.min(candle.open, candle.close, candle.high)) {
      throw new Error(`Invalid candle at index ${index}: OHLC range is inconsistent.`);
    }
    if (index > 0 && candle.openTime <= candles[index - 1].openTime) {
      throw new Error(`Invalid candle at index ${index}: candles must be strictly ordered by openTime.`);
    }
  });
}

function periodsPerYear(candles: MarketCandle[]): number {
  if (candles.length < 2) return 365;
  const deltaMs = Math.max(60_000, candles[1].openTime - candles[0].openTime);
  return (365.25 * 24 * 60 * 60 * 1000) / deltaMs;
}

function sharpeRatio(equity: EquityPoint[], annualization: number): number {
  if (equity.length < 3) return 0;
  const returns: number[] = [];
  for (let i = 1; i < equity.length; i += 1) {
    const previous = equity[i - 1].equity;
    if (previous > 0) returns.push(equity[i].equity / previous - 1);
  }
  if (returns.length < 2) return 0;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  return std === 0 ? 0 : (mean / std) * Math.sqrt(annualization);
}

export function runBacktest(
  ir: StrategyIR,
  candles: MarketCandle[],
  overrides: Partial<BacktestConfig> = {},
): BacktestResult {
  validateCandles(candles);
  if (!ir.indicators.some((indicator) => indicator.name === 'RSI')) {
    throw new Error('The built-in v0.5 engine currently supports deterministic RSI threshold strategies.');
  }

  const config = deriveConfig(ir, overrides);
  validateConfig(config);

  const closes = candles.map((candle) => candle.close);
  const rsiValues = rsi(closes, Math.max(2, Math.round(config.rsiPeriod)));
  const feeRate = config.feeBps / 10_000;
  const slippageRate = config.slippageBps / 10_000;

  let cash = config.initialCapital;
  let quantity = 0;
  let entryPrice = 0;
  let entryTime = 0;
  let entryFee = 0;
  let pendingEntry = false;
  let pendingExit = false;
  let peakEquity = config.initialCapital;
  let totalFees = 0;
  const trades: BacktestTrade[] = [];
  const equityCurve: EquityPoint[] = [];

  const enterPosition = (candle: MarketCandle) => {
    const executionPrice = candle.open * (1 + slippageRate);
    const grossAllocation = (cash * config.positionFraction) / (1 + feeRate);
    const fee = grossAllocation * feeRate;
    quantity = grossAllocation / executionPrice;
    cash -= grossAllocation + fee;
    entryPrice = executionPrice;
    entryTime = candle.openTime;
    entryFee = fee;
    totalFees += fee;
  };

  const exitPosition = (executionPrice: number, exitTime: number, exitReason: BacktestExitReason) => {
    const grossProceeds = quantity * executionPrice;
    const fee = grossProceeds * feeRate;
    const netProceeds = grossProceeds - fee;
    const costBasis = quantity * entryPrice + entryFee;
    const pnl = netProceeds - costBasis;

    cash += netProceeds;
    totalFees += fee;
    trades.push({
      entryTime,
      exitTime,
      entryPrice,
      exitPrice: executionPrice,
      quantity,
      pnl,
      returnPct: costBasis === 0 ? 0 : (pnl / costBasis) * 100,
      fees: entryFee + fee,
      exitReason,
    });

    quantity = 0;
    entryPrice = 0;
    entryTime = 0;
    entryFee = 0;
  };

  for (let i = 0; i < candles.length; i += 1) {
    const candle = candles[i];

    if (pendingExit && quantity > 0) {
      exitPosition(candle.open * (1 - slippageRate), candle.openTime, 'signal');
      pendingExit = false;
    }

    if (pendingEntry && quantity === 0) {
      enterPosition(candle);
      pendingEntry = false;
    }

    if (quantity > 0) {
      const stopPrice = config.stopLossPct === undefined
        ? undefined
        : entryPrice * (1 - config.stopLossPct / 100);
      const takeProfitPrice = config.takeProfitPct === undefined
        ? undefined
        : entryPrice * (1 + config.takeProfitPct / 100);

      const stopHit = stopPrice !== undefined && candle.low <= stopPrice;
      const takeProfitHit = takeProfitPrice !== undefined && candle.high >= takeProfitPrice;

      if (stopHit) {
        const triggerBase = candle.open <= stopPrice! ? candle.open : stopPrice!;
        exitPosition(triggerBase * (1 - slippageRate), candle.closeTime, 'stop-loss');
        pendingExit = false;
      } else if (takeProfitHit) {
        const triggerBase = candle.open >= takeProfitPrice! ? candle.open : takeProfitPrice!;
        exitPosition(triggerBase * (1 - slippageRate), candle.closeTime, 'take-profit');
        pendingExit = false;
      }
    }

    const value = rsiValues[i];
    if (value !== null && i < candles.length - 1) {
      if (quantity === 0 && !pendingEntry && value < config.longEntryRsi) {
        pendingEntry = true;
      } else if (quantity > 0 && !pendingExit && value > config.longExitRsi) {
        pendingExit = true;
      }
    }

    const equity = cash + quantity * candle.close;
    peakEquity = Math.max(peakEquity, equity);
    const drawdownPct = peakEquity === 0 ? 0 : ((peakEquity - equity) / peakEquity) * 100;
    equityCurve.push({ time: candle.closeTime, equity, drawdownPct });
  }

  if (quantity > 0) {
    const candle = candles[candles.length - 1];
    exitPosition(candle.close * (1 - slippageRate), candle.closeTime, 'end-of-data');
    const previousPeak = Math.max(peakEquity, cash);
    equityCurve[equityCurve.length - 1] = {
      time: candle.closeTime,
      equity: cash,
      drawdownPct: previousPeak === 0 ? 0 : ((previousPeak - cash) / previousPeak) * 100,
    };
  }

  const wins = trades.filter((trade) => trade.pnl > 0);
  const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
  const grossLoss = Math.abs(trades.filter((trade) => trade.pnl < 0).reduce((sum, trade) => sum + trade.pnl, 0));
  const maxDrawdownPct = equityCurve.reduce((max, point) => Math.max(max, point.drawdownPct), 0);

  return {
    engineVersion: '0.5.0',
    mode: 'historical-simulation',
    strategyHash: ir.sourceHash,
    assumptions: config,
    metrics: {
      initialCapital: config.initialCapital,
      finalEquity: cash,
      totalReturnPct: ((cash / config.initialCapital) - 1) * 100,
      maxDrawdownPct,
      sharpe: sharpeRatio(equityCurve, periodsPerYear(candles)),
      winRatePct: trades.length === 0 ? 0 : (wins.length / trades.length) * 100,
      profitFactor: grossLoss === 0 ? (grossProfit > 0 ? null : 0) : grossProfit / grossLoss,
      tradeCount: trades.length,
      totalFees,
    },
    trades,
    equityCurve,
    limitations: [
      'The built-in engine currently simulates long-only RSI threshold strategies.',
      'Signals are evaluated at candle close and signal-driven fills occur at the next candle open with fixed slippage.',
      'Stops and take-profit triggers use candle OHLC; when both are touched in one candle, stop-loss is applied first and exact intrabar path is unknown.',
      'Order-book queue position, partial fills, funding, borrow costs, liquidation, and market impact are not modeled.',
      'Historical simulation is research evidence, not a guarantee of future performance.',
    ],
  };
}
