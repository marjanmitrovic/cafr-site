const DEFAULT_DELAY_MS = 10_000;

function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

function retryDelay(response, now) {
  const value = response.headers.get('Retry-After');
  if (!value) return DEFAULT_DELAY_MS;
  const seconds = Number(value);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(ms) && ms >= 0 ? Math.max(1000, ms) : DEFAULT_DELAY_MS;
}

// Only the proxy's explicit Render-hibernation response allows a login replay.
// Ordinary 429s, application errors, network failures and other writes are not retried.
export async function fetchWithWakeup(url, init = {}, {
  fetchImpl = (...args) => fetch(...args),
  wait = pause,
  now = () => Date.now(),
  onWaiting,
  language = 'cs',
  timeoutMs = 120_000,
  maxRetries = 10,
} = {}) {
  const method = String(init.method || 'GET').toUpperCase();
  const pathname = new URL(String(url), 'https://ucfr.cz').pathname;
  const canReplay = ['GET', 'HEAD'].includes(method) ||
    (method === 'POST' && pathname === '/api/auth/login' && typeof init.body === 'string');
  const controller = new AbortController();
  const callerSignal = init.signal;
  const onAbort = () => controller.abort(callerSignal.reason);
  if (callerSignal?.aborted) throw callerSignal.reason;
  callerSignal?.addEventListener('abort', onAbort, { once: true });
  const timeoutError = Object.assign(new Error(language === 'en'
    ? 'The server did not respond in time. Please try again later.'
    : 'Server včas neodpověděl. Zkuste to prosím později.'), { name: 'TimeoutError' });
  const timer = setTimeout(() => controller.abort(timeoutError), timeoutMs);
  const deadline = now() + timeoutMs;

  try {
    for (let attempt = 0; ; attempt += 1) {
      if (controller.signal.aborted) throw controller.signal.reason;
      const response = await fetchImpl(url, { ...init, signal: controller.signal });
      const isWaking = response.status === 503 &&
        response.headers.get('X-UCFR-Response-Source') === 'render-wakeup';
      if (!isWaking || !canReplay) return response;

      const delayMs = retryDelay(response, now());
      if (attempt >= maxRetries || now() + delayMs >= deadline) return response;
      onWaiting?.({ attempt: attempt + 1, delayMs });
      await response.body?.cancel().catch(() => {});
      await wait(delayMs, controller.signal);
    }
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onAbort);
  }
}
