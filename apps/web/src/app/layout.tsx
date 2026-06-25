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
      <head>
        {/* Strip browser-extension-injected attributes (bis_*, __processed_*)
            from the DOM before React hydrates. Extensions like "BIS" or
            screen readers add these synchronously, causing hundreds of
            hydration mismatch warnings. This script runs in the <head> so
            it blocks rendering, ensuring a clean tree by the time React
            hydrates. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function c(e){if(e&&e.removeAttribute){var a=['bis_skin_checked','bis_register'];for(var i=0;i<a.length;i++)if(e.hasAttribute(a[i]))e.removeAttribute(a[i]);var n=e.getAttributeNames();for(var j=0;j<n.length;j++)if(n[j].indexOf('__processed')===0)e.removeAttribute(n[j])}}var w=document.createTreeWalker(document.documentElement,NodeFilter.SHOW_ELEMENT),n;while(n=w.nextNode())c(n);new MutationObserver(function(m){for(var i=0;i<m.length;i++){var o=m[i];if(o.type==='attributes')c(o.target);else if(o.type==='childList'){for(var j=0;j<o.addedNodes.length;j++){var a=o.addedNodes[j];if(a.nodeType===1){c(a);var sw=document.createTreeWalker(a,NodeFilter.SHOW_ELEMENT),sn;while(sn=sw.nextNode())c(sn)}}}}}).observe(document.documentElement,{childList:true,subtree:true,attributes:true})})()`,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
