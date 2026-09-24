import { describe, expect, it } from 'vitest';
import { parseStrategy } from '../lib/trading/parser';
import { analyzeRisk } from '../lib/trading/risk';

describe('analyzeRisk', () => {
  it('flags leverage without a stop', () => {
    const source = `
      rsi_period = 14
      leverage = 10
      if rsi < 30:
          enter_long()
      elif rsi > 70:
          exit_long()
    `;
    const report = analyzeRisk(parseStrategy(source), source);
    const codes = report.findings.map((finding) => finding.code);

    expect(codes).toContain('STOP_COVERAGE_MISSING');
    expect(codes).toContain('HIGH_LEVERAGE');
    expect(codes).toContain('LEVERAGE_WITHOUT_STOP');
    expect(report.score).toBeGreaterThanOrEqual(70);
  });

  it('flags common future-looking constructs', () => {
    const source = `signal = close.shift(-1) > close
if signal: enter_long()`;
    const report = analyzeRisk(parseStrategy(source), source);
    expect(report.findings.some((finding) => finding.code === 'LOOKAHEAD_RISK')).toBe(true);
  });
});
