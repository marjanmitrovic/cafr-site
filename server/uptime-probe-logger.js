// Trace scheduled static probes without logging credentials or querying the DB.
// This marker is diagnostic only; it grants no access or special treatment.
export function uptimeProbeLogger(req, res, next) {
  if (req.method === 'HEAD' && req.path === '/' && req.get('X-UCFR-Uptime-Probe') === '1') {
    const startedAt = Date.now();
    const cfRay = req.get('CF-Ray') || null;
    res.once('finish', () => {
      console.info('[UPTIME HTTP]', JSON.stringify({
        receivedAt: new Date(startedAt).toISOString(),
        method: 'HEAD', path: '/', status: res.statusCode,
        durationMs: Date.now() - startedAt, cfRay,
      }));
    });
  }
  next();
}
