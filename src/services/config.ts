/**
 * Network & API Configuration for DeutschBuddy
 * Handles environment-adaptive API base URL resolution across:
 * - Desktop / Mobile Web Browsers
 * - Google AI Studio Dev & Preview Environments
 * - Android WebView / Median.co Native APK Wrappers
 */

const STORAGE_KEY_API_URL = 'deutsch_buddy_api_url';
export const DEFAULT_PRODUCTION_URL = 'https://ais-pre-iadwnoja36yzsdvly35afp-745913779253.europe-west2.run.app';

/**
 * Log structured network diagnostics safely without leaking sensitive data
 */
export function logNetworkDiagnostic(info: {
  endpoint: string;
  method: string;
  status?: number;
  durationMs: number;
  error?: string;
}): void {
  const timestamp = new Date().toISOString();
  const statusStr = info.status ? `HTTP ${info.status}` : (info.error ? 'FAILED' : 'OK');
  console.log(
    `[Network Diagnostic ${timestamp}] ${info.method} ${info.endpoint} -> ${statusStr} (${info.durationMs}ms)` +
    (info.error ? ` - Error: ${info.error}` : '')
  );
}

/**
 * Detects if the current environment is Android WebView or Median APK
 */
export function isAndroidWebView(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = (navigator.userAgent || '').toLowerCase();
  const isAndroid = ua.includes('android');

  const hasMedianBridge = !!(window as any).median || !!(window as any).gonative;
  const isLocalOrigin =
    window.location.protocol === 'file:' ||
    window.location.origin === 'null' ||
    window.location.origin.includes('localhost') ||
    window.location.origin.includes('127.0.0.1');

  const isWebView =
    ua.includes('wv') ||
    ua.includes('version/4.0') ||
    ua.includes('median') ||
    ua.includes('gonative') ||
    hasMedianBridge ||
    (isAndroid && isLocalOrigin);

  return isAndroid && isWebView;
}

/**
 * Resolves the genuine API Base URL for network requests
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  // 1. Build-time environment variable (e.g. VITE_API_URL in .env)
  const envApiUrl = (((import.meta as any).env?.VITE_API_URL as string) || '').trim();
  if (envApiUrl) {
    return envApiUrl.replace(/\/+$/, '');
  }

  // 2. User-configured / persistent custom server URL in localStorage
  try {
    const savedUrl = (localStorage.getItem(STORAGE_KEY_API_URL) || '').trim();
    if (savedUrl) {
      return savedUrl.replace(/\/+$/, '');
    }
  } catch (e) {
    // localStorage might be restricted
  }

  // 3. Injected bridge variable (e.g. from Median webview config)
  const injectedUrl = ((window as any).__DEUTSCH_BUDDY_API_URL || '').trim();
  if (injectedUrl) {
    return injectedUrl.replace(/\/+$/, '');
  }

  // 4. Current Window Location Origin
  const origin = window.location.origin;
  const protocol = window.location.protocol;

  // If running inside standard Web Browser over HTTP/HTTPS
  if (protocol.startsWith('http')) {
    // If running in Android WebView, localhost:3000 is invalid because the phone has no local node server
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
    if (isAndroidWebView() && isLocalhost) {
      console.warn(
        '[Network] Running inside Android WebView with localhost origin. Falling back to default production Cloud Run server.'
      );
      return DEFAULT_PRODUCTION_URL;
    }
    return origin.replace(/\/+$/, '');
  }

  // 5. If origin is file:// or null (e.g. local offline assets in APK)
  console.warn(
    '[Network] Standalone APK / file:// origin detected. Falling back to default production Cloud Run server.'
  );
  return DEFAULT_PRODUCTION_URL;
}

/**
 * Returns the fully qualified URL for any given API endpoint
 */
export function getEndpointUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const baseUrl = getApiBaseUrl();

  if (!baseUrl) {
    return cleanEndpoint;
  }

  return `${baseUrl}${cleanEndpoint}`;
}

/**
 * Save a custom API URL in localStorage for standalone APK testing
 */
export function setCustomApiUrl(url: string): void {
  try {
    const trimmed = (url || '').trim().replace(/\/+$/, '');
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY_API_URL, trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEY_API_URL);
    }
  } catch (e) {
    console.warn('Failed to save API URL to localStorage:', e);
  }
}

/**
 * Get current configured custom API URL from localStorage
 */
export function getCustomApiUrl(): string {
  try {
    return (localStorage.getItem(STORAGE_KEY_API_URL) || '').trim();
  } catch (e) {
    return '';
  }
}
