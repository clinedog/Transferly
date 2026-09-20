const TELEMETRY_PATH = '/api/client-telemetry';

function sendTelemetry(payload) {
  if (typeof fetch !== 'function') return;
  void fetch(TELEMETRY_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(() => {});
}

function reportWebVital(name, value) {
  if (!Number.isFinite(value) || value < 0) return;
  sendTelemetry({
    event: 'web_vital',
    webVital: name,
    value: Math.round(value * 100) / 100,
    route: window.location.pathname
  });
}

export function startClientTelemetry() {
  if (typeof window === 'undefined' || typeof window.PerformanceObserver === 'undefined') return;
  const reported = new Set();

  const observe = (type, callback) => {
    try {
      const observer = new window.PerformanceObserver((list) => callback(list.getEntries()));
      observer.observe({ type, buffered: true });
    } catch {
      // The browser may not implement every entry type.
    }
  };
  const reportOnce = (name, value) => {
    if (reported.has(name)) return;
    if (!Number.isFinite(value) || value < 0) return;
    reported.add(name);
    reportWebVital(name, value);
  };

  observe('largest-contentful-paint', (entries) => {
    const latest = entries.at(-1);
    reportOnce('LCP', latest?.startTime);
  });
  observe('layout-shift', (entries) => {
    const cumulative = entries.reduce((total, entry) => total + (entry.hadRecentInput ? 0 : entry.value), 0);
    reportOnce('CLS', cumulative);
  });
  observe('first-input', (entries) => {
    const first = entries[0];
    reportOnce('FID', first?.processingStart - first?.startTime);
  });
  observe('paint', (entries) => {
    const firstContentfulPaint = entries.find((entry) => entry.name === 'first-contentful-paint');
    reportOnce('FCP', firstContentfulPaint?.startTime);
  });
}
