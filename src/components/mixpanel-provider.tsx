'use client';

import Script from 'next/script';
import { useEffect } from 'react';

export function MixpanelProvider() {
  useEffect(() => {
    // Suppress Mixpanel version mismatch errors before library loads
    if (typeof window !== 'undefined') {
      const originalError = console.error;
      console.error = function(...args: any[]) {
        // Filter out Mixpanel version mismatch errors
        const errorMessage = args[0];
        if (
          typeof errorMessage === 'string' && 
          (errorMessage.includes('Mixpanel error') || 
           errorMessage.includes('Version mismatch') ||
           errorMessage.includes('mixpanel'))
        ) {
          // Silently ignore Mixpanel errors
          return;
        }
        // Call original console.error for other errors
        originalError.apply(console, args);
      };
    }
  }, []);

  return (
    <Script
      id="mixpanel-init"
      strategy="afterInteractive"
      onLoad={() => {
        // Initialize Mixpanel after script loads
        if (typeof window !== 'undefined' && window.mixpanel && typeof window.mixpanel.init === 'function') {
          window.mixpanel.init('455c59883d9809cf564a48f55a349158', { autocapture: true, record_sessions_percent: 100 });
        }
      }}
      dangerouslySetInnerHTML={{
        // Official Mixpanel snippet - wrapped in safety checks
        __html: `
          (function(){
            if (typeof window === 'undefined' || typeof document === 'undefined') return;
            
            // Mixpanel loader function
            (function(m,e,a,s,u,r,e2,l){
              if (!m || !e) return;
              m['MixpanelObject']=r;
              m[r]=m[r]||function(){(m[r].q=m[r].q||[]).push(arguments)};
              m[r].l=1*new Date();
              u=e.createElement(a);
              if (!u) return;
              u.async=1;
              u.src='https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js';
              l=e.getElementsByTagName(a)[0];
              if(l&&l.parentNode){
                l.parentNode.insertBefore(u,l);
              }else{
                var t=e.head||e.getElementsByTagName('head')[0]||e.body||e.documentElement;
                if(t){
                  t.appendChild(u);
                }
              }
            })(window,document,'script','https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js',void 0,'mixpanel',void 0,void 0);
          })();
        `,
      }}
    />
  );
}

