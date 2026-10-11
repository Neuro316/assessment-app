import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Fresh Air, Neuro Progeny',
  description: 'Guided breathing and visualization practice',
};

export default function FreshAirLayout({ children }: { children: React.ReactNode }) {
  return children;
}
