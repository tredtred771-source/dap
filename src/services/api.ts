import { ChatMessage, CompanionProfile, StoredConversation, SlangTip, DailyUsage } from '../types';
import { getEndpointUrl, logNetworkDiagnostic } from './config';

export interface ChatResponse {
  reply: string;
  arabicTranslation: string;
  grammarCorrection: {
    original: string;
    corrected: string;
    explanationAr: string;
  } | null;
  slangTips: SlangTip[];
  memoryNotes?: string[];
  backendInfo?: {
    model: string;
  };
}

export const STORAGE_KEY_CONVO = 'deutsch_buddy_conversation';
export const STORAGE_KEY_USAGE = 'deutsch_buddy_daily_usage';
export const DAILY_FREE_LIMIT = 1500;

/**
 * Get current day's YYYY-MM-DD string
 */
function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Get daily Gemini API request usage from localStorage
 */
export function getDailyUsage(): DailyUsage {
  const today = getTodayString();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USAGE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === today && typeof parsed.count === 'number') {
        return { count: parsed.count, date: today, limit: DAILY_FREE_LIMIT };
      }
    }
  } catch (e) {
    // ignore
  }

  const initial: DailyUsage = { count: 0, date: today, limit: DAILY_FREE_LIMIT };
  try {
    localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(initial));
  } catch (e) {}
  return initial;
}

/**
 * Increment daily usage counter in localStorage
 */
export function incrementDailyUsage(): DailyUsage {
  const current = getDailyUsage();
  const updated: DailyUsage = {
    count: current.count + 1,
    date: current.date,
    limit: DAILY_FREE_LIMIT,
  };
  try {
    localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(updated));
  } catch (e) {}
  return updated;
}

/**
 * Save conversation and companion memory locally to browser storage
 */
export function saveConversationLocally(data: StoredConversation): boolean {
  try {
    localStorage.setItem(STORAGE_KEY_CONVO, JSON.stringify(data));
    return true;
  } catch (err) {
    console.warn('Failed to save conversation to localStorage:', err);
    return false;
  }
}

/**
 * Load conversation from browser local storage
 */
export function loadConversationLocally(): StoredConversation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONVO);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to load conversation from localStorage:', err);
  }
  return null;
}

/**
 * Clear saved conversation history
 */
export function clearConversationLocally(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_CONVO);
  } catch (e) {}
}

/**
 * Send message to German companion via Gemini API
 */
export async function sendMessageToCompanion(
  companion: CompanionProfile,
  message: string,
  history: ChatMessage[]
): Promise<ChatResponse> {
  const targetUrl = getEndpointUrl('/api/chat');
  const startTime = Date.now();

  const payload = {
    companion,
    message,
    history: history.slice(-8).map((m) => ({
      sender: m.sender,
      text: m.text,
    })),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 28000);

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const durationMs = Date.now() - startTime;
    logNetworkDiagnostic({
      endpoint: targetUrl,
      method: 'POST',
      status: response.status,
      durationMs,
    });

    if (!response.ok) {
      const errText = await response.text();
      let errorDetail = errText;
      try {
        const parsed = JSON.parse(errText);
        errorDetail = parsed.error || errText;
      } catch (e) {
        // Not JSON
      }

      if (response.status === 404) {
        throw new Error(`نقطة النهاية غير موجودة على الخادم (${response.status})`);
      } else if (response.status === 503) {
        throw new Error(`الخادم يواجه ضغطاً مؤقتاً (503): ${errorDetail}`);
      } else if (response.status >= 500) {
        throw new Error(`خطأ في الخادم (${response.status}): ${errorDetail}`);
      }
      throw new Error(errorDetail || `خطأ في الاتصال (${response.status})`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const bodySnippet = (await response.text()).slice(0, 120);
      throw new Error(
        `الخادم أعاد صفحة ويب (${contentType}) بدلاً من استجابة JSON. يرجى التأكد من عنوان السيرفر: ${bodySnippet}`
      );
    }

    const data: ChatResponse = await response.json();

    // Increment client daily usage tracker upon successful interaction
    incrementDailyUsage();

    return data;
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const isTimeout = err?.name === 'AbortError' || err?.message?.includes('aborted');
    const errMsg = isTimeout
      ? 'استغرق الطلب وقتاً طويلاً وتجاوز مهلة الانتظار (28 ثانية).'
      : err?.message || 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت أو عنوان السيرفر.';

    logNetworkDiagnostic({
      endpoint: targetUrl,
      method: 'POST',
      durationMs,
      error: errMsg,
    });

    throw new Error(errMsg);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Health check for backend
 */
export async function getServerHealth(): Promise<{
  geminiReady: boolean;
  freeTierDailyLimit: number;
  audioEngine: string;
  serverUrl?: string;
  error?: string;
}> {
  const targetUrl = getEndpointUrl('/api/health');
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    }).finally(() => clearTimeout(timeoutId));

    const durationMs = Date.now() - startTime;
    logNetworkDiagnostic({
      endpoint: targetUrl,
      method: 'GET',
      status: res.status,
      durationMs,
    });

    if (res.ok) {
      const data = await res.json();
      return {
        ...data,
        serverUrl: targetUrl,
      };
    }
  } catch (e: any) {
    const durationMs = Date.now() - startTime;
    logNetworkDiagnostic({
      endpoint: targetUrl,
      method: 'GET',
      durationMs,
      error: e?.message || 'Failed to connect',
    });
  }

  return {
    geminiReady: true,
    freeTierDailyLimit: DAILY_FREE_LIMIT,
    audioEngine: 'Web Speech API (Browser Native - 100% Free)',
    serverUrl: targetUrl,
    error: 'تعذر الاتصال بخادم الـ API في الوقت الحالي.',
  };
}
