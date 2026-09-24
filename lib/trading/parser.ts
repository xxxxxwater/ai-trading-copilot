import { createHash } from 'node:crypto';
import type { IndicatorSpec, StrategyIR, StrategyLanguage, StrategyRule } from './types';

function detectLanguage(source: string): StrategyLanguage {
  const lower = source.toLowerCase();
  if (lower.includes('istrategy') || lower.includes('populate_entry_trend') || lower.includes('freqtrade')) return 'freqtrade';
  if (lower.includes('script_strategy_base') || lower.includes('hummingbot')) return 'hummingbot';
  if (lower.includes('//@version=') || lower.includes('strategy.entry(') || lower.includes('ta.rsi(')) return 'pine';
  if (/\bdef\s+\w+\s*\(/.test(source) || /\bimport\s+/.test(source) || /\bif\s+.+:/.test(source)) return 'python';
  return 'unknown';
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function extractSymbols(source: string): string[] {
  const matches = source.toUpperCase().match(/\b[A-Z0-9]{2,12}[\/_-]?(?:USDT|USDC|USD|BTC|ETH)\b/g) ?? [];
  return unique(matches.map((value) => value.replace(/[\/_-]/g, ''))).slice(0, 20);
}

function extractTimeframe(source: string): string | undefined {
  const patterns = [
    /timeframe\s*[:=]\s*["']([^"']+)["']/i,
    /interval\s*[:=]\s*["']([^"']+)["']/i,
    /resolution\s*[:=]\s*["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

function extractNumeric(source: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1] !== undefined) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) return value;
    }
  }
  return undefined;
}

function normalizePercent(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const absolute = Math.abs(value);
  return absolute <= 1 ? absolute * 100 : absolute;
}

function collectIndicators(source: string): IndicatorSpec[] {
  const lower = source.toLowerCase();
  const indicators: IndicatorSpec[] = [];

  if (lower.includes('rsi')) {
    const period = extractNumeric(source, [
      /rsi[_\s-]?period\s*[:=]\s*(\d+(?:\.\d+)?)/i,
      /rsi\s*\([^,]+,\s*(\d+(?:\.\d+)?)/i,
      /ta\.rsi\s*\([^,]+,\s*(\d+(?:\.\d+)?)/i,
      /timeperiod\s*=\s*(\d+(?:\.\d+)?)/i,
    ]) ?? 14;
    indicators.push({ name: 'RSI', params: { period }, evidence: `Detected RSI usage (period ${period}).` });
  }

  for (const name of ['EMA', 'SMA', 'MACD', 'ATR', 'VWAP', 'BOLLINGER']) {
    if (lower.includes(name.toLowerCase()) || (name === 'BOLLINGER' && lower.includes('bbands'))) {
      indicators.push({ name, params: {}, evidence: `Detected ${name} usage in strategy source.` });
    }
  }

  return indicators;
}

function collectRules(source: string): { entries: StrategyRule[]; exits: StrategyRule[] } {
  const entries: StrategyRule[] = [];
  const exits: StrategyRule[] = [];

  const rsiLongEntry = source.match(/rsi[^\n]{0,80}?<\s*(\d+(?:\.\d+)?)/i);
  if (rsiLongEntry) {
    entries.push({
      side: 'entry',
      direction: 'long',
      expression: `RSI < ${rsiLongEntry[1]}`,
      evidence: rsiLongEntry[0].trim(),
    });
  }

  const rsiLongExit = source.match(/rsi[^\n]{0,80}?>\s*(\d+(?:\.\d+)?)/i);
  if (rsiLongExit) {
    exits.push({
      side: 'exit',
      direction: 'flat',
      expression: `RSI > ${rsiLongExit[1]}`,
      evidence: rsiLongExit[0].trim(),
    });
  }

  const lower = source.toLowerCase();
  if (entries.length === 0 && /(enter_long|strategy\.entry|buy\s*=\s*true|open_long)/i.test(source)) {
    entries.push({ side: 'entry', direction: 'long', expression: 'Custom long-entry condition', evidence: 'Detected long-entry action.' });
  }
  if (exits.length === 0 && /(exit_long|strategy\.close|sell\s*=\s*true|close_long)/i.test(source)) {
    exits.push({ side: 'exit', direction: 'flat', expression: 'Custom exit condition', evidence: 'Detected exit action.' });
  }
  if (lower.includes('short') && entries.every((rule) => rule.direction !== 'short')) {
    entries.push({ side: 'entry', direction: 'short', expression: 'Custom short-entry condition', evidence: 'Detected short-side strategy logic.' });
  }

  return { entries, exits };
}

function detectOrderType(source: string): 'market' | 'limit' | 'unknown' {
  const lower = source.toLowerCase();
  if (lower.includes('limit')) return 'limit';
  if (lower.includes('market')) return 'market';
  return 'unknown';
}

export function parseStrategy(source: string, name = 'Untitled Strategy'): StrategyIR {
  const trimmed = source.trim();
  if (!trimmed) throw new Error('Strategy source is empty.');

  const language = detectLanguage(trimmed);
  const { entries, exits } = collectRules(trimmed);
  const warnings: string[] = [];
  if (entries.length === 0) warnings.push('No deterministic entry rule could be extracted.');
  if (exits.length === 0) warnings.push('No deterministic exit rule could be extracted.');
  if (language === 'unknown') warnings.push('Strategy language could not be identified reliably.');

  const stopLossPct = normalizePercent(extractNumeric(trimmed, [
    /stop[_\s-]?loss\s*[:=]\s*(-?\d+(?:\.\d+)?)/i,
    /stoploss\s*[:=]\s*(-?\d+(?:\.\d+)?)/i,
  ]));
  const takeProfitPct = normalizePercent(extractNumeric(trimmed, [
    /take[_\s-]?profit\s*[:=]\s*(-?\d+(?:\.\d+)?)/i,
    /takeprofit\s*[:=]\s*(-?\d+(?:\.\d+)?)/i,
  ]));
  const maxLeverage = extractNumeric(trimmed, [
    /max[_\s-]?leverage\s*[:=]\s*(\d+(?:\.\d+)?)/i,
    /leverage\s*[:=]\s*(\d+(?:\.\d+)?)/i,
  ]);
  const maxPositionPct = normalizePercent(extractNumeric(trimmed, [
    /max[_\s-]?position(?:_size)?\s*[:=]\s*(\d+(?:\.\d+)?)/i,
    /position[_\s-]?size\s*[:=]\s*(0?\.\d+|\d+(?:\.\d+)?)/i,
  ]));
  const maxDrawdownPct = normalizePercent(extractNumeric(trimmed, [
    /max[_\s-]?drawdown\s*[:=]\s*(\d+(?:\.\d+)?)/i,
  ]));
  const dcaSteps = extractNumeric(trimmed, [
    /max[_\s-]?(?:entry_)?adjustments\s*[:=]\s*(\d+)/i,
    /dca[_\s-]?(?:steps|orders)\s*[:=]\s*(\d+)/i,
  ]);
  const feeBps = extractNumeric(trimmed, [/fee[_\s-]?bps\s*[:=]\s*(\d+(?:\.\d+)?)/i]) ?? 4;
  const slippageBps = extractNumeric(trimmed, [/slippage[_\s-]?bps\s*[:=]\s*(\d+(?:\.\d+)?)/i]) ?? 2;

  return {
    version: '1.0',
    name,
    sourceHash: createHash('sha256').update(trimmed).digest('hex'),
    language,
    universe: {
      symbols: extractSymbols(trimmed),
      timeframe: extractTimeframe(trimmed),
    },
    indicators: collectIndicators(trimmed),
    entries,
    exits,
    risk: {
      stopLossPct,
      takeProfitPct,
      maxLeverage,
      maxPositionPct,
      maxDrawdownPct,
      dcaSteps: dcaSteps === undefined ? undefined : Math.round(dcaSteps),
    },
    execution: {
      orderType: detectOrderType(trimmed),
      feeBps,
      slippageBps,
    },
    warnings,
  };
}
