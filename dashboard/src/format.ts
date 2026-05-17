/** Format a hash rate (H/s) with an appropriate unit. */
export function formatHashrate(hashrate: number): string {
  if (!Number.isFinite(hashrate) || hashrate <= 0) {
    return '0 H/s';
  }
  if (hashrate < 1_000) {
    return `${hashrate.toFixed(1)} H/s`;
  }
  if (hashrate < 1_000_000) {
    return `${(hashrate / 1_000).toFixed(2)} kH/s`;
  }
  return `${(hashrate / 1_000_000).toFixed(2)} MH/s`;
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
