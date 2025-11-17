const DEFAULT_DEV_URL = 'http://localhost:3000';
const DEFAULT_PROD_URL = 'https://app.looksbyanum.com';

export function getBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();

  if (configuredUrl && configuredUrl.length > 0) {
    return configuredUrl;
  }

  if (process.env.NODE_ENV === 'development') {
    return DEFAULT_DEV_URL;
  }

  return DEFAULT_PROD_URL;
}

