import type {
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  EquityPoint,
  MarketCandle,
  StrategyIR,
} from './types';

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
  output[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i += 1) {
    const change = values[i] - values[i - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    output[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
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
  };
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
  if (candles.length < 30) throw new Error('At least 30 candles are required for backtesting.');
  if (!ir.indicators.some((indicator) => indicator.name === 'RSI')) {
    throw new Error('The built-in v0.4 engine currently supports deterministic RSI threshold strategies.');
  }

  const config = deriveConfig(ir, overrides);
  if (config.longEntryRsi >= config.longExitRsi) throw new Error('RSI entry threshold must be lower than exit threshold.');

  const closes = candles.map((candle) => candle.close);
  const rsiValues = rsi(closes, Math.max(2, Math.round(config.rsiPeriod)));
  const feeRate = config.feeBps / 10_000;
  const slippageRate = config.slippageBps / 10_000;

  let cash = config.initialCapital;
  let quantity = 0;
  let entryPrice = 0;
  let entryTime = 0;
  let entryFee = 0;
  let peakEquity = config.initialCapital;
  let totalFees = 0;
  const trades: BacktestTrade[] = [];
  const equityCurve: EquityPoint[] = [];

  for (let i = 0; i < candles.length; i += 1) {
    const candle = candles[i];
    const value = rsiValues[i];

    if (value !== null && quantity === 0 && value < config.longEntryRsi) {
      const executionPrice = candle.close * (1 + slippageRate);
      const grossAllocation = (cash * config.positionFraction) / (1 + feeRate);
      const fee = grossAllocation * feeRate;
      quantity = grossAllocation / executionPrice;
      cash -= grossAllocation + fee;
      entryPrice = executionPrice;
      entryTime = candle.closeTime;
      entryFee = fee;
      totalFees += fee;
    } else if (value !== null && quantity > 0 && value > config.longExitRsi) {
      const executionPrice = candle.close * (1 - slippageRate);
      const grossProceeds = quantity * executionPrice;
      const fee = grossProceeds * feeRate;
      const netProceeds = grossProceeds - fee;
      const costBasis = quantity * entryPrice + entryFee;
      const pnl = netProceeds - costBasis;
      cash += netProceeds;
      totalFees += fee;
      trades.push({
        entryTime,
        exitTime: candle.closeTime,
        entryPrice,
        exitPrice: executionPrice,
        quantity,
        pnl,
        returnPct: costBasis === 0 ? 0 : (pnl / costBasis) * 100,
        fees: entryFee + fee,
      });
      quantity = 0;
      entryPrice = 0;
      entryTime = 0;
      entryFee = 0;
    }

    const equity = cash + quantity * candle.close;
    peakEquity = Math.max(peakEquity, equity);
    const drawdownPct = peakEquity === 0 ? 0 : ((peakEquity - equity) / peakEquity) * 100;
    equityCurve.push({ time: candle.closeTime, equity, drawdownPct });
  }

  if (quantity > 0) {
    const candle = candles[candles.length - 1];
    const executionPrice = candle.close * (1 - slippageRate);
    const grossProceeds = quantity * executionPrice;
    const fee = grossProceeds * feeRate;
    const netProceeds = grossProceeds - fee;
    const costBasis = quantity * entryPrice + entryFee;
    const pnl = netProceeds - costBasis;
    cash += netProceeds;
    totalFees += fee;
    trades.push({
      entryTime,
      exitTime: candle.closeTime,
      entryPrice,
      exitPrice: executionPrice,
      quantity,
      pnl,
      returnPct: costBasis === 0 ? 0 : (pnl / costBasis) * 100,
      fees: entryFee + fee,
    });
    quantity = 0;
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
    engineVersion: '0.4.0',
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
      'Fills are modeled at candle close with fixed fee and slippage assumptions; order-book queue position and partial fills are not modeled.',
      'Historical simulation is research evidence, not a guarantee of future performance.',
    ],
  };
}
