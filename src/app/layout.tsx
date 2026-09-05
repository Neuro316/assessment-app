import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Capacity Assessment — Neuro Progeny',
  description: 'Nervous system capacity assessment using real-time objective biometrics',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
