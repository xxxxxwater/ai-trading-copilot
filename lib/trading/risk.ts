import { parseStrategy } from './parser';
import type { RiskFinding, RiskReport, StrategyIR } from './types';

const penalty: Record<RiskFinding['severity'], number> = {
  info: 0,
  low: 5,
  medium: 12,
  high: 22,
  critical: 35,
};

export function analyzeRisk(ir: StrategyIR, source = ''): RiskReport {
  const findings: RiskFinding[] = [];
  const lower = source.toLowerCase();

  if (ir.risk.stopLossPct === undefined) {
    findings.push({
      code: 'STOP_COVERAGE_MISSING',
      severity: 'critical',
      title: 'No explicit stop-loss extracted',
      detail: 'The strategy IR has no explicit loss boundary. Add a deterministic stop or portfolio-level loss guard before considering live execution.',
    });
  }

  if (ir.exits.length === 0) {
    findings.push({
      code: 'EXIT_RULE_MISSING',
      severity: 'high',
      title: 'No deterministic exit rule extracted',
      detail: 'The parser could not establish how an open position is closed. Backtests and live risk controls are unreliable without an explicit exit path.',
    });
  }

  if ((ir.risk.maxLeverage ?? 1) > 5) {
    findings.push({
      code: 'HIGH_LEVERAGE',
      severity: 'high',
      title: 'High leverage configured',
      detail: `Extracted leverage is ${ir.risk.maxLeverage}x. Stress-test liquidation distance, gap risk, and funding before use.`,
    });
  }

  if ((ir.risk.maxLeverage ?? 1) > 1 && ir.risk.stopLossPct === undefined) {
    findings.push({
      code: 'LEVERAGE_WITHOUT_STOP',
      severity: 'critical',
      title: 'Leverage without extracted stop-loss',
      detail: 'Leverage is present while no explicit stop-loss was extracted, which can create unbounded downside relative to intended risk.',
    });
  }

  if (ir.risk.maxPositionPct === undefined) {
    findings.push({
      code: 'POSITION_CAP_MISSING',
      severity: 'medium',
      title: 'No explicit position-size cap extracted',
      detail: 'Add a deterministic maximum allocation or notional cap so signal generation cannot implicitly consume all available capital.',
    });
  }

  if ((ir.risk.dcaSteps ?? 0) >= 3 && ir.risk.maxPositionPct === undefined) {
    findings.push({
      code: 'DCA_WITHOUT_EXPOSURE_CAP',
      severity: 'high',
      title: 'DCA detected without an exposure cap',
      detail: `The strategy allows ${ir.risk.dcaSteps} DCA steps but no maximum position allocation was extracted.`,
    });
  }

  if (/shift\s*\(\s*-\d+/.test(lower) || lower.includes('lookahead_on') || lower.includes('future_data')) {
    findings.push({
      code: 'LOOKAHEAD_RISK',
      severity: 'critical',
      title: 'Potential look-ahead bias',
      detail: 'The source contains a future-looking construct. Verify that every feature is calculated only from data available at decision time.',
      evidence: 'Detected negative shift, lookahead_on, or future_data pattern.',
    });
  }

  if (lower.includes('martingale') || /size\s*\*=\s*2/.test(lower)) {
    findings.push({
      code: 'MARTINGALE_RISK',
      severity: 'high',
      title: 'Potential martingale sizing',
      detail: 'Loss-dependent size escalation can create convex downside and should be bounded by explicit exposure and drawdown guards.',
    });
  }

  if (ir.execution.orderType === 'unknown') {
    findings.push({
      code: 'ORDER_MODEL_UNSPECIFIED',
      severity: 'low',
      title: 'Order type is unspecified',
      detail: 'Backtest fill assumptions should state whether entries and exits use market, limit, maker, or taker execution.',
    });
  }

  if (ir.execution.feeBps === 0 && ir.execution.slippageBps === 0) {
    findings.push({
      code: 'FRICTIONLESS_BACKTEST',
      severity: 'medium',
      title: 'Zero execution friction',
      detail: 'A zero-fee and zero-slippage model can materially overstate performance, particularly for high-turnover strategies.',
    });
  }

  if (ir.warnings.length > 0) {
    findings.push({
      code: 'PARSER_UNCERTAINTY',
      severity: 'medium',
      title: 'Strategy parser has unresolved assumptions',
      detail: ir.warnings.join(' '),
    });
  }

  const score = Math.min(100, findings.reduce((total, finding) => total + penalty[finding.severity], 0));
  const level: RiskReport['level'] = score >= 70 ? 'critical' : score >= 45 ? 'high' : score >= 20 ? 'moderate' : 'low';

  return {
    score,
    level,
    findings,
    checkedAt: new Date().toISOString(),
  };
}

export function staticRiskScan(source: string): RiskFinding[] {
  return analyzeRisk(parseStrategy(source), source).findings;
}
