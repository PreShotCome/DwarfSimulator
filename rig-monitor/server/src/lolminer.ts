import type { Snapshot, Worker } from './nicehash';

/**
 * Reads lolMiner's local HTTP API (enabled with `--apiport 4444`) and folds it
 * into the same normalized Snapshot the dashboard renders. This runs on the rig,
 * so it reaches lolMiner over localhost with no CORS issues and uses no GPU —
 * it's just JSON. Field names are read defensively because lolMiner's API shape
 * has shifted across versions; missing fields are simply omitted.
 */

const LOLMINER_API = process.env.LOLMINER_API_URL ?? 'http://127.0.0.1:4444';
export const LOLMINER_API_URL = LOLMINER_API;

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
}

/** First present numeric field among candidate keys (handles version drift). */
function pick(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    if (obj[k] != null && Number.isFinite(num(obj[k]))) return num(obj[k]);
  }
  return null;
}

/** lolMiner reports speed in its own unit (e.g. "mh/s"); convert to H/s. */
function unitToHs(value: number, unit?: string): number {
  const u = (unit ?? 'mh/s').toLowerCase();
  if (u.startsWith('g')) return value * 1e9;
  if (u.startsWith('m')) return value * 1e6;
  if (u.startsWith('k')) return value * 1e3;
  return value;
}

function fmtHashrate(hs: number): string {
  const units = ['H/s', 'kH/s', 'MH/s', 'GH/s'];
  let v = hs;
  let u = 0;
  while (v >= 1000 && u < units.length - 1) {
    v /= 1000;
    u += 1;
  }
  return `${v.toFixed(2)} ${units[u]}`;
}

interface LolResponse {
  Mining?: {
    Performance_Unit?: string;
    Total_Performance?: number;
    Total_Accepted?: number;
    Total_Rejected?: number;
  };
  Workers?: Array<Record<string, unknown>>;
  Session?: { Accepted?: number };
}

export async function buildLolminerSnapshot(): Promise<Snapshot> {
  const res = await fetch(LOLMINER_API);
  if (!res.ok) throw new Error(`lolMiner API → ${res.status}`);
  const data = (await res.json()) as LolResponse;
  const unit = data.Mining?.Performance_Unit;

  const workers: Worker[] = (data.Workers ?? []).map((w, i) => {
    const hashrate = unitToHs(pick(w, ['Performance']) ?? 0, unit);
    const temp = pick(w, ['Temp', 'Temperature', 'GPU_Temp']);
    const power = pick(w, ['Power', 'Juice', 'Watt']);
    const fan = pick(w, ['Fan_Speed', 'Fan', 'Fan_Percent']);
    const core = pick(w, ['Core_Clock', 'CCLK', 'Core_Frequency']);
    const mem = pick(w, ['Mem_Clock', 'MCLK', 'Memory_Frequency']);
    const extra: Array<{ label: string; value: string }> = [];
    if (temp != null) extra.push({ label: 'GPU temp', value: `${temp}°C` });
    if (power != null) extra.push({ label: 'Power', value: `${power.toFixed(0)} W` });
    if (fan != null) extra.push({ label: 'Fan', value: `${fan}%` });
    if (core != null) extra.push({ label: 'Core clock', value: `${core} MHz` });
    if (mem != null) extra.push({ label: 'Mem clock', value: `${mem} MHz` });
    const nameVal = w.Name;
    return {
      id: `lolminer:${pick(w, ['Index']) ?? i}`,
      name: typeof nameVal === 'string' && nameVal ? nameVal : `GPU ${i}`,
      status: hashrate > 0 ? 'online' : 'offline',
      hashrate,
      accepted: pick(w, ['Accepted']) ?? 0,
      rejected: pick(w, ['Rejected']) ?? 0,
      lastSeen: Date.now(),
      extra,
    };
  });

  const totalHashrate =
    unitToHs(num(data.Mining?.Total_Performance), unit) ||
    workers.reduce((s, w) => s + w.hashrate, 0);
  const totalPower = (data.Workers ?? []).reduce(
    (s, w) => s + (pick(w, ['Power', 'Juice', 'Watt']) ?? 0),
    0,
  );
  const accepted =
    num(data.Mining?.Total_Accepted) ||
    num(data.Session?.Accepted) ||
    workers.reduce((s, w) => s + w.accepted, 0);
  const rejected =
    num(data.Mining?.Total_Rejected) || workers.reduce((s, w) => s + w.rejected, 0);
  const effMhW = totalPower > 0 ? totalHashrate / 1e6 / totalPower : 0;

  const stats = [
    { label: 'Live hashrate', value: fmtHashrate(totalHashrate), accent: true },
    ...(totalPower > 0 ? [{ label: 'Power', value: `${totalPower.toFixed(0)} W` }] : []),
    ...(effMhW > 0 ? [{ label: 'Efficiency', value: `${effMhW.toFixed(2)} Mh/s/W` }] : []),
    { label: 'Accepted / Rejected', value: `${accepted} / ${rejected}` },
  ];

  return { status: 'live', stats, workers, totalHashrate, generatedAt: Date.now() };
}
