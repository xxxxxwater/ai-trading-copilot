import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Trading Copilot',
  description: 'AI-native quant research, deterministic risk analysis, and reproducible backtesting.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
