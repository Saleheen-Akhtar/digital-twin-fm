import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Digital Twin FM',
  description: 'AI-powered Digital Twin Facility Management',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning silences the React warning when browser
    // extensions (password managers, accessibility tools) inject attributes
    // like `webcrx=""` into <html> before React hydrates. The HTML still
    // works correctly; this just prevents the dev-mode noise.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
