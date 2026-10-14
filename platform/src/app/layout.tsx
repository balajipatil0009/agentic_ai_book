import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'StudyMate — Learn agentic AI by building it',
    template: '%s · StudyMate',
  },
  description:
    'Get out of the tutorial loop. Build a real agentic product on Day 1, track your streak and study time, and work through a production-ready syllabus — learn by doing.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${mono.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
