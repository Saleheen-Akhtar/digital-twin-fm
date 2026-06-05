import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Digital Twin FM',
  description: 'AI-powered Digital Twin Facility Management',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
