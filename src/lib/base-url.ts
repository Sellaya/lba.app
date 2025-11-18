const DEFAULT_DEV_URL = 'http://localhost:3000';
const DEFAULT_PROD_URL = 'https://app.looksbyanum.com';

export function getBaseUrl(): string {
  // Check for explicitly configured URL first
  const configuredUrl = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_BASE_URL?.trim();
  
  if (configuredUrl && configuredUrl.length > 0) {
    return configuredUrl;
  }

  // Check NODE_ENV safely
  const nodeEnv = typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined;
  
  if (nodeEnv === 'development') {
    return DEFAULT_DEV_URL;
  }

  // Default to production URL
  return DEFAULT_PROD_URL;
}

