/** Format a hash rate (H/s) with an appropriate unit. */
export function formatHashrate(hashrate: number): string {
  if (!Number.isFinite(hashrate) || hashrate <= 0) {
    return '0 H/s';
  }
  const units = ['H/s', 'kH/s', 'MH/s', 'GH/s', 'TH/s'];
  let value = hashrate;
  let unit = 0;
  while (value >= 1_000 && unit < units.length - 1) {
    value /= 1_000;
    unit += 1;
  }
  return `${value.toFixed(value < 100 ? 2 : 1)} ${units[unit]}`;
}

/** Format an uptime in seconds as a compact human-readable string. */
export function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0s';
  }
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!days && !hours) parts.push(`${secs}s`);
  return parts.join(' ');
}

/** Format an integer with thousands separators. */
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/** Format a coin amount with sensible precision for small balances. */
export function formatCoin(amount: number, unit: string): string {
  if (!Number.isFinite(amount)) {
    return `0 ${unit}`;
  }
  const decimals = amount !== 0 && Math.abs(amount) < 1 ? 6 : 4;
  return `${amount.toFixed(decimals)} ${unit}`;
}

/** Compact relative time, e.g. "12s ago", "3m ago". */
export function formatAgo(epochMs: number): string {
  const delta = Math.max(0, Date.now() - epochMs);
  const secs = Math.floor(delta / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}
