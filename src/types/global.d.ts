// Global type declarations

interface Window {
  mixpanel?: {
    init: (token: string, config?: { autocapture?: boolean; record_sessions_percent?: number }) => void;
    track: (event: string, properties?: Record<string, any>) => void;
    identify: (id: string) => void;
    reset: () => void;
    [key: string]: any;
  };
}

