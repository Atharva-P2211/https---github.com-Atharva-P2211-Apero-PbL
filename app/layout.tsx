import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Aperio — Cloaked Phishing Detection Agent',
  description: 'Infrastructure-first cloaked phishing detection powered by Gemini and forensic RDAP/network signals.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased selection:bg-cyan-500 selection:text-black">
        <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-mono text-cyan-400 font-bold tracking-widest text-lg">APERIO</span>
              <span className="text-xs px-2 py-0.5 rounded-full border border-neutral-700 text-neutral-400">v1</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/" className="hover:text-cyan-400 transition-colors">Checker</Link>
              <Link href="/history" className="hover:text-cyan-400 transition-colors">Live History</Link>
              <Link href="/eval" className="hover:text-cyan-400 transition-colors">Eval Dashboard</Link>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
