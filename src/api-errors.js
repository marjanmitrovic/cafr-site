export function apiError(response, data, language = 'cs') {
  const czech = language !== 'en';
  const detail = typeof data?.error === 'string' ? data.error.trim() : '';
  let message = detail;

  if (response.status === 503 && response.headers.get('X-UCFR-Response-Source') === 'render-wakeup') {
    message = czech
      ? 'Server se stále spouští. Zkuste se prosím přihlásit znovu za chvíli.'
      : 'The server is still starting. Please try signing in again shortly.';
  } else if (!message && response.status === 429) {
    message = czech
      ? 'Server dočasně omezuje provoz. Požadavek nyní nelze dokončit. Neodesílejte jej opakovaně.'
      : 'The server is temporarily limiting traffic. This request cannot be completed now. Please avoid submitting it repeatedly.';
  } else if (!message && response.status >= 500) {
    message = czech
      ? 'Server je dočasně nedostupný nebo se právě spouští. Zkuste to prosím později.'
      : 'The server is temporarily unavailable or starting up. Please try again later.';
  }

  const error = new Error(message || `${response.status} ${response.statusText}`.trim());
  error.status = response.status;
  error.requestId = response.headers.get('X-UCFR-Request-ID') || '';
  error.source = response.headers.get('X-UCFR-Response-Source') || 'upstream';
  error.retryAfter = response.headers.get('Retry-After') || '';
  return error;
}
