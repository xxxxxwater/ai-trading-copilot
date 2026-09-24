export type StrategyLanguage = 'freqtrade' | 'hummingbot' | 'pine' | 'python' | 'unknown';

export type StrategyRule = {
  side: 'entry' | 'exit';
  direction: 'long' | 'short' | 'flat';
  expression: string;
  evidence: string;
};

export type IndicatorSpec = {
  name: string;
  params: Record<string, number | string | boolean>;
  evidence: string;
};

export type StrategyIR = {
  version: '1.0';
  name: string;
  sourceHash: string;
  language: StrategyLanguage;
  universe: {
    symbols: string[];
    timeframe?: string;
  };
  indicators: IndicatorSpec[];
  entries: StrategyRule[];
  exits: StrategyRule[];
  risk: {
    stopLossPct?: number;
    takeProfitPct?: number;
    maxLeverage?: number;
    maxPositionPct?: number;
    maxDrawdownPct?: number;
    dcaSteps?: number;
  };
  execution: {
    orderType: 'market' | 'limit' | 'unknown';
    feeBps: number;
    slippageBps: number;
  };
  warnings: string[];
};

export type RiskSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type RiskFinding = {
  code: string;
  severity: RiskSeverity;
  title: string;
  detail: string;
  evidence?: string;
};

export type RiskReport = {
  score: number;
  level: 'low' | 'moderate' | 'high' | 'critical';
  findings: RiskFinding[];
  checkedAt: string;
};

export type MarketCandle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};

export type BacktestConfig = {
  initialCapital: number;
  feeBps: number;
  slippageBps: number;
  rsiPeriod: number;
  longEntryRsi: number;
  longExitRsi: number;
  positionFraction: number;
};

export type BacktestTrade = {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  returnPct: number;
  fees: number;
};

export type EquityPoint = {
  time: number;
  equity: number;
  drawdownPct: number;
};

export type BacktestMetrics = {
  initialCapital: number;
  finalEquity: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  sharpe: number;
  winRatePct: number;
  profitFactor: number | null;
  tradeCount: number;
  totalFees: number;
};

export type BacktestResult = {
  engineVersion: '0.4.0';
  mode: 'historical-simulation';
  strategyHash: string;
  assumptions: BacktestConfig;
  metrics: BacktestMetrics;
  trades: BacktestTrade[];
  equityCurve: EquityPoint[];
  limitations: string[];
};
