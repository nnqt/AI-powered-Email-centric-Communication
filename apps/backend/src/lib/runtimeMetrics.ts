type CounterMap = Record<string, number>;
type TimerMap = Record<string, { count: number; totalMs: number; maxMs: number }>;

const counters: CounterMap = {};
const timers: TimerMap = {};

export function incrementMetric(name: string, by = 1): void {
  counters[name] = (counters[name] || 0) + by;
}

export function observeMetricMs(name: string, durationMs: number): void {
  const safeDuration = Math.max(0, Math.round(durationMs));
  const current = timers[name] || { count: 0, totalMs: 0, maxMs: 0 };
  current.count += 1;
  current.totalMs += safeDuration;
  current.maxMs = Math.max(current.maxMs, safeDuration);
  timers[name] = current;
}

export function getRuntimeMetricsSnapshot() {
  const timerStats = Object.fromEntries(
    Object.entries(timers).map(([name, t]) => [
      name,
      {
        count: t.count,
        avgMs: t.count > 0 ? Math.round(t.totalMs / t.count) : 0,
        maxMs: t.maxMs,
        totalMs: t.totalMs,
      },
    ]),
  );

  return {
    generatedAt: new Date().toISOString(),
    counters: { ...counters },
    timers: timerStats,
  };
}
