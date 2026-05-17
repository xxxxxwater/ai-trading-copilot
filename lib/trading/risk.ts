export type RiskFinding = { severity: 'low' | 'medium' | 'high'; title: string; detail: string };
export function staticRiskScan(source: string): RiskFinding[] {
  const findings: RiskFinding[] = [];
  const lower = source.toLowerCase();
  if (!lower.includes('stop') && !lower.includes('risk')) findings.push({ severity: 'high', title: 'No obvious stop-loss or risk control', detail: 'The strategy text does not show explicit stop-loss, drawdown, or position risk logic.' });
  if (lower.includes('leverage') && !lower.includes('max')) findings.push({ severity: 'medium', title: 'Leverage lacks visible cap', detail: 'Leverage appears in the strategy, but a maximum exposure guard is not obvious.' });
  if (!lower.includes('fee') && !lower.includes('slippage')) findings.push({ severity: 'medium', title: 'Fees and slippage may be missing', detail: 'Backtest results can be overstated if fees, spread, and slippage are not modeled.' });
  return findings;
}
