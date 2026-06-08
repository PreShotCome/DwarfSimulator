import type { Snapshot, Worker } from './nicehash';

/**
 * Reads lolMiner's local HTTP API (enabled with `--apiport 4444`) and folds it
 * into the same normalized Snapshot the dashboard renders. Runs on the rig, so
 * it reaches lolMiner over localhost with no CORS and uses no GPU — it's JSON.
 *
 * Field layout verified against lolMiner 1.98: hardware stats (Power, CCLK,
 * MCLK, Core_Temp, Fan_Speed) live in `Workers[]`, while mining stats live in
 * `Algorithms[]` — Total_Performance + per-GPU `Worker_Performance[]`, scaled to
 * H/s by `Performance_Factor` (e.g. 1e6 for "Mh/s").
 */

const LOLMINER_API = process.env.LOLMINER_API_URL ?? 'http://127.0.0.1:4444';
export const LOLMINER_API_URL = LOLMINER_API;

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

interface LolAlgorithm {
  Performance_Factor?: number;
  Total_Performance?: number;
  Total_Accepted?: number;
  Total_Rejected?: number;
  Total_Stales?: number;
  Worker_Performance?: number[];
  Worker_Accepted?: number[];
  Worker_Rejected?: number[];
  Worker_Stales?: number[];
}

interface LolHwWorker {
  Index?: number;
  Name?: string;
  Power?: number;
  CCLK?: number;
  MCLK?: number;
  Core_Temp?: number;
  Mem_Temp?: number;
  Fan_Speed?: number;
}

interface LolResponse {
  Workers?: LolHwWorker[];
  Algorithms?: LolAlgorithm[];
}

export async function buildLolminerSnapshot(): Promise<Snapshot> {
  const res = await fetch(LOLMINER_API);
  if (!res.ok) throw new Error(`lolMiner API → ${res.status}`);
  const data = (await res.json()) as LolResponse;

  // Use the primary algorithm (single-algo mining; first entry if dual).
  const algo = data.Algorithms?.[0] ?? {};
  const factor = num(algo.Performance_Factor) || 1e6;
  const hw = data.Workers ?? [];

  const workers: Worker[] = hw.map((w, i) => {
    const hashrate = num(algo.Worker_Performance?.[i]) * factor;
    const accepted = num(algo.Worker_Accepted?.[i]);
    const rejected = num(algo.Worker_Rejected?.[i]) + num(algo.Worker_Stales?.[i]);
    const extra: Array<{ label: string; value: string }> = [];
    if (num(w.Core_Temp)) extra.push({ label: 'GPU temp', value: `${num(w.Core_Temp)}°C` });
    if (num(w.Mem_Temp)) extra.push({ label: 'Mem temp', value: `${num(w.Mem_Temp)}°C` });
    if (num(w.Power)) extra.push({ label: 'Power', value: `${num(w.Power).toFixed(0)} W` });
    if (num(w.Fan_Speed)) extra.push({ label: 'Fan', value: `${num(w.Fan_Speed)}%` });
    if (num(w.CCLK)) extra.push({ label: 'Core clock', value: `${num(w.CCLK)} MHz` });
    if (num(w.MCLK)) extra.push({ label: 'Mem clock', value: `${num(w.MCLK)} MHz` });
    return {
      id: `lolminer:${num(w.Index) || i}`,
      name: w.Name || `GPU ${i}`,
      status: hashrate > 0 ? 'online' : 'offline',
      hashrate,
      accepted,
      rejected,
      lastSeen: Date.now(),
      extra,
    };
  });

  const totalHashrate =
    num(algo.Total_Performance) * factor || workers.reduce((s, w) => s + w.hashrate, 0);
  const totalPower = hw.reduce((s, w) => s + num(w.Power), 0);
  const accepted = num(algo.Total_Accepted);
  const rejected = num(algo.Total_Rejected) + num(algo.Total_Stales);
  const effMhW = totalPower > 0 ? totalHashrate / 1e6 / totalPower : 0;

  const stats = [
    { label: 'Live hashrate', value: fmtHashrate(totalHashrate), accent: true },
    ...(totalPower > 0 ? [{ label: 'Power', value: `${totalPower.toFixed(0)} W` }] : []),
    ...(effMhW > 0 ? [{ label: 'Efficiency', value: `${effMhW.toFixed(2)} Mh/s/W` }] : []),
    { label: 'Accepted / Rejected', value: `${accepted} / ${rejected}` },
  ];

  return { status: 'live', stats, workers, totalHashrate, generatedAt: Date.now() };
}
