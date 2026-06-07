import {
  placeholderSnapshot,
  type Source,
  type SourceConfig,
  type SourceSnapshot,
  type Worker,
} from './types';
import { formatCoin, formatHashrate, formatNumber } from '../format';

/**
 * Ergo source — LIVE. Reads the public herominers pool API by wallet address.
 * No API key or secret is required: pool stats keyed on a payout address are
 * public, so this works straight from the browser with just the user's `9…`
 * address. If the pool blocks cross-origin requests in your environment, point
 * `apiBase` at a proxy that forwards to ergo.herominers.com.
 *
 * Field names below were verified against a live herominers response: workers
 * are objects with `shares_good` / `shares_invalid` / `shares_stale`, and the
 * current hash rate is `hashrate` (with `hashrate_1h` as a smoothed average).
 */

const DEFAULT_API_BASE = 'https://ergo.herominers.com/api';
const ERG_DECIMALS = 1e9; // 1 ERG = 1e9 nanoERG (confirmed: config.coinUnits)
/** A worker is considered offline if it hasn't shared in 10 min. */
const OFFLINE_AFTER_MS = 10 * 60 * 1000;

interface HeroStats {
  hashrate?: number;
  hashrate_1h?: number;
  balance?: string | number;
  shares_good?: number;
  shares_invalid?: number;
  shares_stale?: number;
}

interface HeroWorker {
  name?: string;
  hashrate?: number;
  hashrate_1h?: number;
  lastShare?: number | string;
  shares_good?: number;
  shares_invalid?: number;
  shares_stale?: number;
  agent?: string;
}

interface HeroResponse {
  stats?: HeroStats;
  workers?: HeroWorker[];
  /** Present (e.g. "Not found") when the pool has no record of the address. */
  error?: string;
}

function num(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

/** herominers timestamps are seconds; tolerate both s and ms. */
function toMs(ts: unknown): number {
  const n = num(ts);
  if (n === 0) return 0;
  return n < 1e12 ? n * 1000 : n;
}

function parseWorkers(raw: HeroWorker[] | undefined): Worker[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((w, i) => {
    const hashrate = num(w.hashrate);
    const lastSeen = toMs(w.lastShare) || Date.now();
    const accepted = num(w.shares_good);
    const rejected = num(w.shares_invalid) + num(w.shares_stale);
    const online = Date.now() - lastSeen < OFFLINE_AFTER_MS;
    const avg1h = num(w.hashrate_1h);
    return {
      id: `ergo:${w.name || i}`,
      name: w.name || `worker ${i + 1}`,
      status: online ? 'online' : 'offline',
      hashrate,
      accepted,
      rejected,
      lastSeen,
      extra: [
        ...(avg1h ? [{ label: '1h avg', value: formatHashrate(avg1h) }] : []),
        ...(w.agent ? [{ label: 'Miner', value: w.agent }] : []),
      ],
    };
  });
}

/** Cheap sanity check for a mainnet Ergo P2PK address (starts with 9, base58). */
function looksLikeErgoAddress(addr: string): boolean {
  return /^9[1-9A-HJ-NP-Za-km-z]{39,59}$/.test(addr);
}

/** Fold a (possibly empty) herominers response into a live snapshot. */
function toSnapshot(data: HeroResponse): SourceSnapshot {
  const stats = data.stats ?? {};
  const workers = parseWorkers(data.workers);
  const totalHashrate =
    num(stats.hashrate) || workers.reduce((sum, w) => sum + w.hashrate, 0);
  const balance = num(stats.balance) / ERG_DECIMALS;
  const validShares =
    num(stats.shares_good) || workers.reduce((sum, w) => sum + w.accepted, 0);
  const onlineCount = workers.filter((w) => w.status === 'online').length;

  return {
    status: 'live',
    stats: [
      { label: 'Pool hashrate', value: formatHashrate(totalHashrate), accent: true },
      { label: 'Unpaid balance', value: formatCoin(balance, 'ERG') },
      { label: 'Valid shares', value: formatNumber(validShares) },
      { label: 'Workers online', value: `${onlineCount} / ${workers.length}` },
    ],
    workers,
    totalHashrate,
    generatedAt: Date.now(),
  };
}

async function fetchSnapshot(config: SourceConfig): Promise<SourceSnapshot> {
  const address = (config.address ?? '').trim();
  if (!address) {
    return placeholderSnapshot(
      'unconfigured',
      'Add your Ergo payout address (starts with “9…”) to start monitoring.',
    );
  }
  if (!looksLikeErgoAddress(address)) {
    return placeholderSnapshot(
      'unconfigured',
      'That doesn’t look like a mainnet Ergo address (they start with “9”). Double-check it.',
    );
  }
  const apiBase = (config.apiBase || DEFAULT_API_BASE).replace(/\/$/, '');

  let data: HeroResponse;
  try {
    const res = await fetch(
      `${apiBase}/stats_address?address=${encodeURIComponent(address)}&longpoll=false`,
    );
    if (!res.ok) {
      return placeholderSnapshot('error', `Pool API returned ${res.status}.`);
    }
    data = (await res.json()) as HeroResponse;
  } catch {
    return placeholderSnapshot(
      'error',
      'Could not reach the pool API. If this is a CORS block, set an “API base” proxy in settings.',
    );
  }

  // herominers returns {"error":"Not found"} for an address it has never seen.
  // The address is well-formed, so this just means mining hasn't started yet:
  // show a populated, zeroed "waiting for first shares" view rather than an error.
  if (data.error) {
    return toSnapshot({});
  }

  return toSnapshot(data);
}

export const ergoSource: Source = {
  id: 'ergo',
  label: 'Ergo',
  emoji: '🟠',
  accent: '#f74c00',
  coinUnit: 'ERG',
  tagline: 'Mine ERG to your own wallet · herominers pool',
  configFields: [
    {
      key: 'address',
      label: 'Ergo payout address',
      placeholder: '9f...your wallet address',
      help: 'Your self-custody Ergo address. Public pool stats are keyed on it — no API key needed.',
    },
    {
      key: 'apiBase',
      label: 'API base (optional)',
      placeholder: DEFAULT_API_BASE,
      help: 'Only change this if the pool API is CORS-blocked and you are routing through a proxy.',
    },
  ],
  fetchSnapshot,
};
