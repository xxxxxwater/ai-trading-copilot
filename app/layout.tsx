import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'AI Trading Copilot', description: 'AI-native trading strategy review and backtest explanation' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
