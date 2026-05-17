'use client';
import { useState } from 'react';
import { TradingViewWidget } from '@/components/tradingview-widget';
const example = `# Example strategy\n# Paste Freqtrade, Hummingbot, Pine Script, or Python strategy here\nif rsi < 30:\n    enter_long()\nelif rsi > 70:\n    exit_long()`;
export default function Page() {
  const [strategy, setStrategy] = useState(example);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  async function analyze() {
    setLoading(true); setResult(null);
    const res = await fetch('/api/analyze-strategy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Draft Strategy', strategy }) });
    setResult(await res.json()); setLoading(false);
  }
  return <main className="mx-auto max-w-7xl p-6 space-y-6">
    <header className="space-y-2"><p className="text-sm uppercase tracking-[0.3em] text-emerald-400">AI Trading Copilot</p><h1 className="text-4xl font-bold">Strategy review, backtest explanation, and risk analysis</h1><p className="text-gray-400">Built with Next.js, TypeScript, Vercel AI SDK, PostgreSQL, Drizzle, Tailwind, and TradingView.</p></header>
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3"><h2 className="text-xl font-semibold">Paste strategy</h2><textarea className="min-h-[520px] w-full rounded-2xl border border-white/10 bg-white/5 p-4 font-mono text-sm" value={strategy} onChange={e=>setStrategy(e.target.value)} /><button onClick={analyze} disabled={loading} className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-black disabled:opacity-50">{loading ? 'Analyzing...' : 'Analyze Strategy'}</button></div>
      <div className="space-y-3"><h2 className="text-xl font-semibold">Market context</h2><TradingViewWidget /></div>
    </section>
    {result && <section className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4"><h2 className="text-2xl font-bold">AI Review</h2><p><b>Summary:</b> {result.summary}</p><p><b>Signal logic:</b> {result.signalLogic}</p><p><b>Backtest explanation:</b> {result.backtestExplanation}</p><div><b>Risk review:</b><ul className="list-disc pl-6">{result.riskReview?.map((x:string,i:number)=><li key={i}>{x}</li>)}</ul></div><div><b>Improvement plan:</b><ul className="list-disc pl-6">{result.improvementPlan?.map((x:string,i:number)=><li key={i}>{x}</li>)}</ul></div>{result.staticFindings?.length ? <div><b>Static risk scan:</b><ul className="list-disc pl-6">{result.staticFindings.map((x:any,i:number)=><li key={i}>{x.severity.toUpperCase()}: {x.title} - {x.detail}</li>)}</ul></div> : null}</section>}
  </main>;
}
