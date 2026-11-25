// This limits the time reserved by monitoring, not total billed runtime:
// real visitors can keep Render running outside the monitoring window.
export const UPTIME_BUDGET = Object.freeze({
  timeZone: 'Europe/Prague',
  startHour: 10,
  endHour: 21,
  monthlyHours: 350,
  idleGraceMinutes: 15,
});

const localClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: UPTIME_BUDGET.timeZone,
  year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric',
  hourCycle: 'h23',
});

export function monitoringWindow(date) {
  if (!Number.isFinite(date.getTime())) return { allowed: false, reason: 'invalid-time' };
  const parts = Object.fromEntries(localClock.formatToParts(date).map(part => [part.type, part.value]));
  const days = new Date(Date.UTC(Number(parts.year), Number(parts.month), 0)).getUTCDate();
  // Reserve a full idle timeout per day, including after the final probe.
  const plannedHours = days * (UPTIME_BUDGET.endHour - UPTIME_BUDGET.startHour + UPTIME_BUDGET.idleGraceMinutes / 60);
  const hour = Number(parts.hour);
  return {
    allowed: plannedHours <= UPTIME_BUDGET.monthlyHours &&
      hour >= UPTIME_BUDGET.startHour && hour < UPTIME_BUDGET.endHour,
    plannedHours,
    monthlyLimitHours: UPTIME_BUDGET.monthlyHours,
  };
}

export async function probeRenderUptime({ env = {}, scheduledTime, now = () => new Date(),
  fetchImpl = (...args) => fetch(...args), log = result => console.log('[UCFR UPTIME]', JSON.stringify(result)),
  timeoutMs = 90_000 } = {}) {
  // Allow monitoring to be disabled without changing application requests.
  if (env.UCFR_UPTIME_MONITOR_ENABLED !== 'true') return { skipped: 'disabled' };
  const currentTime = now();
  const scheduled = new Date(scheduledTime);
  const ageMs = currentTime.getTime() - scheduled.getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 180_000) {
    const result = { skipped: 'stale-schedule', ageMs: Number.isFinite(ageMs) ? ageMs : null };
    log(result);
    return result;
  }
  const window = monitoringWindow(currentTime);
  if (!window.allowed || !monitoringWindow(scheduled).allowed) return { skipped: 'outside-window' };

  // HEAD on the static homepage makes no database query. Never probe the SQL
  // readiness endpoint (/api/health), fetch a whole page, or send credentials.
  const target = new URL('/', env.UCFR_BACKEND_ORIGIN || 'https://cafr-site.onrender.com');
  if (target.protocol !== 'https:' || target.username || target.password) return { skipped: 'invalid-origin' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let result;
  try {
    const response = await fetchImpl(target.toString(), {
      method: 'HEAD', redirect: 'manual', cache: 'no-store', credentials: 'omit', signal: controller.signal,
      headers: { 'X-UCFR-Uptime-Probe': '1' },
    });
    result = {
      checkedAt: currentTime.toISOString(),
      scheduledAt: scheduled.toISOString(),
      delayMs: ageMs,
      status: response.status,
      ok: response.ok,
      challenge: response.headers.get('cf-mitigated') === 'challenge',
      cfRay: response.headers.get('cf-ray'),
      renderRouting: response.headers.get('x-render-routing'),
      renderRequestId: response.headers.get('rndr-id'),
      plannedMonitoringHours: window.plannedHours,
    };
    await response.body?.cancel().catch(() => {});
  } catch {
    result = { checkedAt: currentTime.toISOString(), scheduledAt: scheduled.toISOString(), delayMs: ageMs, ok: false, error: controller.signal.aborted ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
  }
  // Record the gateway evidence. No retries, challenge solving or alternate routes.
  log(result);
  return result;
}
