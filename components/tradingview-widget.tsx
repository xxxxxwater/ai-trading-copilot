'use client';
import { useEffect, useRef } from 'react';
export function TradingViewWidget({ symbol = 'BINANCE:BTCUSDT' }: { symbol?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({ autosize: true, symbol, interval: '60', timezone: 'Etc/UTC', theme: 'dark', style: '1', locale: 'en', allow_symbol_change: true, support_host: 'https://www.tradingview.com' });
    ref.current.appendChild(script);
  }, [symbol]);
  return <div className="h-[520px] rounded-2xl border border-white/10 bg-black/30"><div ref={ref} className="tradingview-widget-container h-full w-full" /></div>;
}
