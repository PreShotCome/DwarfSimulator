import type { Snapshot, Worker } from './nicehash';

/**
 * Reads NiceHash's Excavator engine local API (default http://127.0.0.1:18000)
 * and folds it into the same normalized Snapshot the dashboard renders. Used so
 * the "Rig (live)" view works while mining on NiceHash, not just lolMiner.
 *
 * Verified against Excavator 1.9.x:
 *  - worker.list  → workers[].algorithms[].speed is already in H/s
 *  - devices.get  → per-device gpu_temp, gpu_power_usage, gpu_clock_core/_memory,
 *                   gpu_fan_speed, __vram_temp, __hotspot_temp, hw_errors
 * Excavator binds to [::1] by default, so we try both IPv4 and IPv6 localhost.
 */

const EXCAVATOR_BASES = process.env.EXCAVATOR_API_URL
  ? [process.env.EXCAVATOR_API_URL]
  : ['http://127.0.0.1:18000', 'http://[::1]:18000'];

export const EXCAVATOR_API_LABEL = EXCAVATOR_BASES[0];

function num(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
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

/** Call an Excavator JSON command over HTTP, trying each localhost form. */
async function excavatorCmd<T>(method: string): Promise<T> {
  const cmd = encodeURIComponent(JSON.stringify({ id: 1, method, params: [] }));
  let lastErr: unknown;
  for (const base of EXCAVATOR_BASES) {
    try {
      const res = await fetch(`${base}/api?command=${cmd}`);
      if (res.ok) return (await res.json()) as T;
      lastErr = new Error(`Excavator ${method} → ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('Excavator unreachable');
}

interface ExWorker {
  device_id?: number;
  algorithms?: Array<{ name?: string; speed?: number }>;
}

interface ExDevice {
  device_id?: number;
  name?: string;
  gpu_temp?: number;
  gpu_power_usage?: number;
  gpu_fan_speed?: number;
  gpu_clock_core?: number;
  gpu_clock_memory?: number;
  __vram_temp?: number;
  __hotspot_temp?: number;
  hw_errors?: number;
}

export async function buildExcavatorSnapshot(): Promise<Snapshot> {
  const [wl, dg] = await Promise.all([
    excavatorCmd<{ workers?: ExWorker[] }>('worker.list'),
    excavatorCmd<{ devices?: ExDevice[] }>('devices.get'),
  ]);

  // Sum each device's algorithm speeds (H/s), keyed by device_id.
  const speedByDevice = new Map<number, { speed: number; algo: string }>();
  for (const w of wl.workers ?? []) {
    const did = num(w.device_id);
    const speed = (w.algorithms ?? []).reduce((s, a) => s + num(a.speed), 0);
    const algo = w.algorithms?.[0]?.name ?? '';
    const prev = speedByDevice.get(did);
    speedByDevice.set(did, {
      speed: (prev?.speed ?? 0) + speed,
      algo: prev?.algo || algo,
    });
  }

  const devices = dg.devices ?? [];
  const workers: Worker[] = devices.map((d, i) => {
    const did = num(d.device_id);
    const sp = speedByDevice.get(did);
    const hashrate = sp?.speed ?? 0;
    const extra: Array<{ label: string; value: string }> = [];
    if (sp?.algo) extra.push({ label: 'Algorithm', value: sp.algo });
    if (num(d.gpu_temp)) extra.push({ label: 'GPU temp', value: `${num(d.gpu_temp)}°C` });
    if (num(d.__vram_temp)) extra.push({ label: 'VRAM temp', value: `${num(d.__vram_temp)}°C` });
    if (num(d.__hotspot_temp)) extra.push({ label: 'Hotspot', value: `${num(d.__hotspot_temp)}°C` });
    if (num(d.gpu_power_usage)) extra.push({ label: 'Power', value: `${num(d.gpu_power_usage).toFixed(0)} W` });
    if (num(d.gpu_fan_speed)) extra.push({ label: 'Fan', value: `${num(d.gpu_fan_speed)}%` });
    if (num(d.gpu_clock_core)) extra.push({ label: 'Core clock', value: `${num(d.gpu_clock_core)} MHz` });
    if (num(d.gpu_clock_memory)) extra.push({ label: 'Mem clock', value: `${num(d.gpu_clock_memory)} MHz` });
    return {
      id: `excavator:${did || i}`,
      name: d.name || `GPU ${did}`,
      status: hashrate > 0 ? 'online' : 'offline',
      hashrate,
      accepted: 0,
      rejected: num(d.hw_errors),
      lastSeen: Date.now(),
      extra,
    };
  });

  const totalHashrate = workers.reduce((s, w) => s + w.hashrate, 0);
  const totalPower = devices.reduce((s, d) => s + num(d.gpu_power_usage), 0);
  const effMhW = totalPower > 0 ? totalHashrate / 1e6 / totalPower : 0;
  const algo = workers[0]?.extra?.find((e) => e.label === 'Algorithm')?.value;

  const stats = [
    { label: 'Live hashrate', value: fmtHashrate(totalHashrate), accent: true },
    ...(totalPower > 0 ? [{ label: 'Power', value: `${totalPower.toFixed(0)} W` }] : []),
    ...(effMhW > 0 ? [{ label: 'Efficiency', value: `${effMhW.toFixed(2)} Mh/s/W` }] : []),
    ...(algo ? [{ label: 'Algorithm', value: algo }] : []),
  ];

  return { status: 'live', stats, workers, totalHashrate, generatedAt: Date.now() };
}
