'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  Braces,
  ChartCandlestick,
  Database,
  FlaskConical,
  Gauge,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { TradingViewWidget } from '@/components/tradingview-widget';

const example = `# RSI mean-reversion research example
timeframe = "1h"
symbol = "BTCUSDT"
rsi_period = 14
stop_loss = -0.05
max_position_size = 0.25
fee_bps = 4
slippage_bps = 2

if rsi < 30:
    enter_long()
elif rsi > 70:
    exit_long()`;

type Finding = {
  code: string;
  severity: string;
  title: string;
  detail: string;
};

type AnalyzeResponse = {
  ir: {
    language: string;
    sourceHash: string;
    universe: { symbols: string[]; timeframe?: string };
    indicators: Array<{ name: string; params: Record<string, unknown> }>;
    entries: Array<{ expression: string }>;
    exits: Array<{ expression: string }>;
    warnings: string[];
  };
  risk: { score: number; level: string; findings: Finding[] };
  aiReview: {
    summary: string;
    signalLogic: string[];
    backtestRisks: string[];
    executionRisks: string[];
    regimeRisks: string[];
    improvementPlan: string[];
  };
  metadata: { aiStatus: string; model: string | null; analyzedAt: string };
};

type BacktestResponse = {
  symbol: string;
  interval: string;
  dataSource: string;
  candleCount: number;
  datasetHash: string;
  result: {
    engineVersion: string;
    metrics: {
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
    trades: Array<{ entryTime: number; exitTime: number; pnl: number; returnPct: number }>;
    limitations: string[];
  };
};

type MarketSnapshot = {
  source: string;
  symbol: string;
  timestamp: string;
  freshnessMs: number;
  lastPrice: number;
  priceChangePct24h: number;
  high24h: number;
  low24h: number;
  quoteVolume24h: number;
  recentVolatilityPct: number;
};

const severityClass: Record<string, string> = {
  critical: 'border-red-400/30 bg-red-400/10 text-red-100',
  high: 'border-orange-400/30 bg-orange-400/10 text-orange-100',
  medium: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  low: 'border-blue-400/30 bg-blue-400/10 text-blue-100',
  info: 'border-white/10 bg-white/[0.03] text-slate-200',
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-100">{value}</div>
    </div>
  );
}

export default function Page() {
  const [strategy, setStrategy] = useState(example);
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState('1h');
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [backtest, setBacktest] = useState<BacktestResponse | null>(null);
  const [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'backtesting' | 'market'>('idle');
  const [error, setError] = useState<string | null>(null);

  const tvSymbol = useMemo(
    () => `BINANCE:${symbol.toUpperCase().replace(/[\/_-]/g, '')}`,
    [symbol],
  );

  const request = useCallback(async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, init);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? `Request failed with ${response.status}`);
    return data as T;
  }, []);

  const refreshMarket = useCallback(async () => {
    setStatus('market');
    setError(null);
    try {
      const data = await request<MarketSnapshot>(
        `/api/market-snapshot?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`,
      );
      setMarket(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Market request failed.');
    } finally {
      setStatus('idle');
    }
  }, [interval, request, symbol]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialMarket() {
      try {
        const data = await request<MarketSnapshot>(
          `/api/market-snapshot?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`,
        );
        if (!cancelled) setMarket(data);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Market request failed.');
      }
    }

    void loadInitialMarket();
    return () => {
      cancelled = true;
    };
  }, [interval, request, symbol]);

  async function analyze() {
    setStatus('analyzing');
    setError(null);
    setAnalysis(null);
    try {
      const data = await request<AnalyzeResponse>('/api/analyze-strategy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Workspace Strategy', strategy }),
      });
      setAnalysis(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Analysis failed.');
    } finally {
      setStatus('idle');
    }
  }

  async function runHistoricalBacktest() {
    setStatus('backtesting');
    setError(null);
    setBacktest(null);
    try {
      const data = await request<BacktestResponse>('/api/backtest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          strategy,
          name: 'Workspace Strategy',
          symbol,
          interval,
          limit: 500,
          initialCapital: 10_000,
        }),
      });
      setBacktest(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Backtest failed.');
    } finally {
      setStatus('idle');
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-5 flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-400">
            <Sparkles size={14} /> AI Trading Copilot · Research Runtime
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Strategy intelligence with deterministic evidence.
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Parse strategy logic into a reproducible IR, run deterministic risk checks, simulate supported
            strategies on public market data, then use AI to explain the evidence. No live order path is exposed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">read-only market tools</span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">Strategy IR v1</span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">Backtest v0.4</span>
        </div>
      </header>

      {error && (
        <div className="mb-5 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(420px,0.9fr)_minmax(620px,1.4fr)]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 shadow-2xl shadow-black/20">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Braces size={18} className="text-emerald-400" />
                <h2 className="font-semibold">Strategy source</h2>
              </div>
              <span className="text-xs text-slate-500">Python · Freqtrade · Hummingbot · Pine</span>
            </div>
            <textarea
              className="min-h-[440px] w-full resize-y rounded-xl border border-white/10 bg-black/30 p-4 font-mono text-[13px] leading-6 text-slate-200 transition focus:border-emerald-400/40"
              value={strategy}
              onChange={(event) => setStrategy(event.target.value)}
              spellCheck={false}
            />
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <input
                value={symbol}
                onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
                aria-label="Symbol"
              />
              <select
                value={interval}
                onChange={(event) => setInterval(event.target.value)}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
              >
                {['5m', '15m', '1h', '4h', '1d'].map((value) => <option key={value}>{value}</option>)}
              </select>
              <button
                onClick={analyze}
                disabled={status !== 'idle'}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-40"
              >
                <Bot size={16} /> {status === 'analyzing' ? 'Analyzing…' : 'Analyze'}
              </button>
              <button
                onClick={runHistoricalBacktest}
                disabled={status !== 'idle'}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-semibold transition hover:bg-white/[0.08] disabled:opacity-40"
              >
                <FlaskConical size={16} /> {status === 'backtesting' ? 'Running…' : 'Backtest'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={17} className="text-blue-400" />
                <h2 className="font-semibold">Live market context</h2>
              </div>
              <button
                onClick={refreshMarket}
                disabled={status !== 'idle'}
                className="rounded-lg border border-white/10 p-2 text-slate-400 hover:text-white disabled:opacity-40"
                aria-label="Refresh market data"
              >
                <RefreshCw size={14} className={status === 'market' ? 'animate-spin' : ''} />
              </button>
            </div>
            {market ? (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Metric label="Last" value={formatMoney(market.lastPrice)} />
                <Metric label="24h" value={`${market.priceChangePct24h.toFixed(2)}%`} />
                <Metric label="Recent vol" value={`${market.recentVolatilityPct.toFixed(3)}%`} />
                <Metric label="Freshness" value={`${Math.round(market.freshnessMs / 1000)}s`} />
              </div>
            ) : (
              <p className="text-sm text-slate-500">Public Binance snapshot is loading.</p>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <div className="mb-3 flex items-center gap-2">
              <ChartCandlestick size={18} className="text-emerald-400" />
              <h2 className="font-semibold">Market chart</h2>
            </div>
            <TradingViewWidget symbol={tvSymbol} />
          </div>

          {analysis && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={19} className="text-amber-400" />
                  <h2 className="text-lg font-semibold">Strategy review</h2>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-slate-400">{analysis.ir.language}</span>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-slate-400">AI: {analysis.metadata.aiStatus}</span>
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-amber-100">
                    risk {analysis.risk.score}/100
                  </span>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-300">{analysis.aiReview.summary}</p>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Metric label="Indicators" value={analysis.ir.indicators.map((item) => item.name).join(', ') || 'none'} />
                <Metric label="Entry rules" value={String(analysis.ir.entries.length)} />
                <Metric label="Exit rules" value={String(analysis.ir.exits.length)} />
              </div>

              <div className="mt-5 space-y-2">
                {analysis.risk.findings.map((finding) => (
                  <div
                    key={finding.code}
                    className={`rounded-xl border p-3 ${severityClass[finding.severity] ?? severityClass.info}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-sm">{finding.title}</strong>
                      <span className="text-[10px] uppercase tracking-[0.18em] opacity-70">{finding.severity}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 opacity-80">{finding.detail}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Bot size={15} /> AI improvement plan
                  </div>
                  <ul className="space-y-2 text-sm leading-5 text-slate-400">
                    {analysis.aiReview.improvementPlan.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Database size={15} /> Reproducibility
                  </div>
                  <div className="space-y-2 text-xs text-slate-400">
                    <p>Strategy hash: <code className="text-slate-300">{analysis.ir.sourceHash.slice(0, 16)}…</code></p>
                    <p>Prompt: <code className="text-slate-300">strategy-review-v2</code></p>
                    <p>Model: <code className="text-slate-300">{analysis.metadata.model ?? 'deterministic fallback'}</code></p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {backtest && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Gauge size={19} className="text-cyan-400" />
                  <h2 className="text-lg font-semibold">Historical simulation</h2>
                </div>
                <span className="text-xs text-slate-500">
                  {backtest.candleCount} candles · {backtest.symbol} {backtest.interval}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="Return" value={`${backtest.result.metrics.totalReturnPct.toFixed(2)}%`} />
                <Metric label="Max DD" value={`${backtest.result.metrics.maxDrawdownPct.toFixed(2)}%`} />
                <Metric label="Sharpe" value={backtest.result.metrics.sharpe.toFixed(2)} />
                <Metric label="Win rate" value={`${backtest.result.metrics.winRatePct.toFixed(1)}%`} />
                <Metric label="Final equity" value={formatMoney(backtest.result.metrics.finalEquity)} />
                <Metric label="Trades" value={String(backtest.result.metrics.tradeCount)} />
                <Metric label="Fees" value={formatMoney(backtest.result.metrics.totalFees)} />
                <Metric
                  label="Profit factor"
                  value={backtest.result.metrics.profitFactor === null ? '∞ / n.a.' : backtest.result.metrics.profitFactor.toFixed(2)}
                />
              </div>
              <div className="mt-4 rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-3 text-xs leading-5 text-cyan-50/75">
                {backtest.result.limitations.join(' ')} Dataset hash: {backtest.datasetHash.slice(0, 16)}…
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
