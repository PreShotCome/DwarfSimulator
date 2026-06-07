import {
  placeholderSnapshot,
  type Source,
  type SourceConfig,
  type SourceSnapshot,
  type Worker,
} from './types';
import { formatCoin, formatHashrate } from '../format';

/**
 * Ergo source — LIVE. Reads the public herominers pool API by wallet address.
 * No API key or secret is required: pool stats keyed on a payout address are
 * public, so this works straight from the browser with just the user's `9…`
 * address. If the pool blocks cross-origin requests in your environment, point
 * `apiBase` at a proxy that forwards to ergo.herominers.com.
 */

const DEFAULT_API_BASE = 'https://ergo.herominers.com/api';
const ERG_DECIMALS = 1e9; // 1 ERG = 1e9 nanoERG
/** A herominers worker is considered offline if it hasn't shared in 10 min. */
const OFFLINE_AFTER_MS = 10 * 60 * 1000;

interface HeroStats {
  hashrate?: number;
  balance?: string | number;
  paid?: string | number;
  hashes?: string | number;
  lastShare?: string | number;
}

interface HeroResponse {
  stats?: HeroStats;
  // herominers returns workers either as a keyed object or an array of rows.
  workers?: unknown;
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

/** Normalize the many shapes herominers can use for the workers field. */
function parseWorkers(raw: unknown): Worker[] {
  const rows: Array<{ name: string; values: unknown[] }> = [];

  if (Array.isArray(raw)) {
    // Array of [name, hashrate, lastShare, validShares, staleShares, ...].
    for (const row of raw) {
      if (Array.isArray(row)) {
        rows.push({ name: String(row[0] ?? 'worker'), values: row });
      } else if (row && typeof row === 'object') {
        const o = row as Record<string, unknown>;
        rows.push({
          name: String(o.name ?? o.worker ?? o.rigId ?? 'worker'),
          values: [o.name, o.hashrate, o.lastShare, o.validShares, o.invalidShares],
        });
      }
    }
  } else if (raw && typeof raw === 'object') {
    // Keyed object: { "rig1": { hashrate, lastShare, ... }, ... }.
    for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
      const o = (value ?? {}) as Record<string, unknown>;
      rows.push({
        name,
        values: [name, o.hashrate ?? o.hashRate, o.lastShare ?? o.lastBeat, o.validShares ?? o.shares, o.invalidShares ?? o.staleShares],
      });
    }
  }

  return rows.map((r, i) => {
    const hashrate = num(r.values[1]);
    const lastSeen = toMs(r.values[2]) || Date.now();
    const accepted = num(r.values[3]);
    const rejected = num(r.values[4]);
    const online = Date.now() - lastSeen < OFFLINE_AFTER_MS;
    const worker: Worker = {
      id: `ergo:${r.name || i}`,
      name: r.name || `worker ${i + 1}`,
      status: online ? 'online' : 'offline',
      hashrate,
      accepted,
      rejected,
      lastSeen,
    };
    return worker;
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
  const paid = num(stats.paid) / ERG_DECIMALS;
  const onlineCount = workers.filter((w) => w.status === 'online').length;

  return {
    status: 'live',
    stats: [
      { label: 'Pool hashrate', value: formatHashrate(totalHashrate), accent: true },
      { label: 'Unpaid balance', value: formatCoin(balance, 'ERG') },
      { label: 'Total paid', value: formatCoin(paid, 'ERG') },
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
