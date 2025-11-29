import type {Metadata} from 'next';
import Script from 'next/script';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { BrandingFooter } from '@/components/branding-footer';
import { MixpanelProvider } from '@/components/mixpanel-provider';

export const metadata: Metadata = {
  title: 'Looks by Anum',
  description: 'Book your makeup artist for any occasion with Looks by Anum.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Looks by Anum" />
        <link rel="apple-touch-icon" href="/LBA.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Alegreya:ital,wght@0,400..900;1,400..900&family=Belleza&display=swap" rel="stylesheet" />
        <noscript>
          <img height="1" width="1" style={{display: 'none'}} src="https://www.facebook.com/tr?id=1450542242503112&ev=PageView&noscript=1" alt="" />
        </noscript>
      </head>
      <body className="font-body antialiased flex flex-col min-h-screen" suppressHydrationWarning>
        <Script
          id="facebook-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {try{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.onerror=function(){console.warn('Facebook Pixel script blocked by ad blocker');};
              t.src=v;s=b.getElementsByTagName(e)[0];
              if(s)s.parentNode.insertBefore(t,s)}catch(e){console.warn('Facebook Pixel initialization error:',e);}}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              try{fbq('init', '1450542242503112');fbq('track', 'PageView');}catch(e){console.warn('Facebook Pixel tracking error:',e);}
            `,
          }}
        />
        <MixpanelProvider />
        <Script
          id="service-worker"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('ServiceWorker registration successful');
                    })
                    .catch(function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    });
                });
              }
            `,
          }}
        />
        <FirebaseClientProvider>
          <div className="flex flex-col min-h-screen">
            <main className="flex-1">
              {children}
            </main>
            <BrandingFooter />
          </div>
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
