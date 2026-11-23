import { proxyToRender } from './functions/_shared/render-proxy.js';
import { probeRenderUptime, monitoringWindow, UPTIME_BUDGET } from './functions/_shared/uptime-monitor.js';

function shouldProxy(pathname) {
  return pathname === '/api' ||
    pathname.startsWith('/api/') ||
    pathname === '/uploads' ||
    pathname.startsWith('/uploads/');
}

function edgeHealth(env) {
  return Response.json(
    {
      ok: true,
      service: 'ucfr-cloudflare-edge',
      backendOrigin: String(env?.UCFR_BACKEND_ORIGIN || ''),
      checkedAt: new Date().toISOString(),
      uptimeMonitoring: {
        configured: env?.UCFR_UPTIME_MONITOR_ENABLED === 'true',
        timeZone: UPTIME_BUDGET.timeZone,
        startHour: UPTIME_BUDGET.startHour,
        endHour: UPTIME_BUDGET.endHour,
        plannedMonitoringHoursThisMonth: monitoringWindow(new Date()).plannedHours,
        monthlyMonitoringLimitHours: UPTIME_BUDGET.monthlyHours,
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  );
}

export default {
  async scheduled(controller, env) {
    await probeRenderUptime({ env, scheduledTime: controller.scheduledTime });
  },
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/edge-health') {
      return edgeHealth(env);
    }

    if (shouldProxy(url.pathname)) {
      return proxyToRender({ request, env });
    }

    return env.ASSETS.fetch(request);
  },
};
