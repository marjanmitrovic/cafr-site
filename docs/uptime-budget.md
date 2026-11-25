# Render uptime monitoring budget

The monitor runs every 10 minutes only between 10:00 and 21:00 in
Europe/Prague, including weekends. Daylight saving changes follow that timezone.
It sends a single credential-free HEAD request to the static Render homepage,
not `/api/health`, which queries Neon. There are no retries or alternate routes.

The conservative planned runtime reservation is 11 hours plus a full 15-minute
idle grace per day: 337.5 hours in a 30-day month, or 348.75 hours in a 31-day
month. Both fit the requested 350-hour monitoring budget. This is a schedule
estimate, not measured billing. A month has at most 2,046 monitoring requests.

This does **not** cap total Render runtime. Visitors can keep the service active
outside this window, and other services share the workspace's free hour balance.
Enforcing a hard account/runtime cap would require accurate usage accounting and
potentially suspending the public service. This change does neither.

Monitoring is enabled after review of the current shared Render hour balance.
`UCFR_UPTIME_MONITOR_ENABLED` is `true` and `triggers.crons` is
`["*/10 * * * *"]` in `wrangler.jsonc`. To disable it, set the flag to `false`
and remove the cron expression. The handler tolerates up to three minutes of cron dispatch delay, allows up to 90 seconds for one cold-start response, logs stale dispatches, and rejects invocations outside the Prague window. Skipped events make no Render request.
`/api/edge-health` reports the deployed configuration and planned monthly hours;
it does not itself probe Render or claim that a scheduled check already ran.

Probes carry `X-UCFR-Uptime-Probe: 1` so the application can record arrivals as
`[UPTIME HTTP]` in Render logs. These records contain the arrival time, method,
static path, HTTP status, duration and CF-Ray only. They never include credentials,
cookies, query strings or bodies. The marker grants no access or special routing.
A successful scheduled arrival proves that request reached the running application;
missing records alone cannot distinguish a missing cron invocation from a gateway
block before the application. Deployment/configuration success is not runtime proof.

A static probe itself issues no SQL query. Application restarts and real users
can still query Neon. Reduced Neon compute use must be verified in live metrics.
Gateway blocks are recorded with CF-Ray/Render identifiers for support; monitoring
does not remove a managed challenge or guarantee that the sign-in problem is fixed.

Login proxy traces in Cloudflare Observability record the edge and upstream Ray IDs, status, Render request ID, duration and whether the application or a gateway challenge responded. No login payload, credentials or cookies are logged. The trace does not bypass challenges or change application rate limits. The time window and number of scheduled probes remain unchanged.
