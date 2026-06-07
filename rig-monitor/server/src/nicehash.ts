import crypto from 'node:crypto';

/**
 * Minimal NiceHash API v2 client. NiceHash requires every request to be signed
 * with an HMAC-SHA256 over a very specific field layout (key, time, nonce,
 * org-id, method, path, query), joined by NUL bytes. This is why NiceHash must
 * be proxied: the secret can never reach the browser, and NiceHash blocks
 * cross-origin calls.
 *
 * Reference: https://github.com/nicehash/rest-clients-demo
 */

export interface NiceHashCreds {
  apiKey: string;
  apiSecret: string;
  orgId: string;
  apiBase: string;
}

export function readCreds(): NiceHashCreds | null {
  const apiKey = process.env.NICEHASH_API_KEY ?? '';
  const apiSecret = process.env.NICEHASH_API_SECRET ?? '';
  const orgId = process.env.NICEHASH_ORG_ID ?? '';
  if (!apiKey || !apiSecret || !orgId) {
    return null;
  }
  return {
    apiKey,
    apiSecret,
    orgId,
    apiBase: process.env.NICEHASH_API_BASE ?? 'https://api2.nicehash.com',
  };
}

function sign(
  creds: NiceHashCreds,
  method: string,
  path: string,
  query: string,
  time: string,
  nonce: string,
): string {
  // Fields joined by NUL (\x00), with the empty placeholders NiceHash expects
  // between nonce/org and org/method.
  const segments = [
    creds.apiKey,
    time,
    nonce,
    '',
    creds.orgId,
    '',
    method,
    path,
    query,
  ];
  const input = segments.join('\x00');
  const digest = crypto
    .createHmac('sha256', creds.apiSecret)
    .update(input, 'utf8')
    .digest('hex');
  return `${creds.apiKey}:${digest}`;
}

async function get<T>(creds: NiceHashCreds, path: string, query = ''): Promise<T> {
  const time = Date.now().toString();
  const nonce = crypto.randomUUID();
  const auth = sign(creds, 'GET', path, query, time, nonce);
  const url = `${creds.apiBase}${path}${query ? `?${query}` : ''}`;
  const res = await fetch(url, {
    headers: {
      'X-Time': time,
      'X-Nonce': nonce,
      'X-Auth': auth,
      'X-Organization-Id': creds.orgId,
      'X-Request-Id': crypto.randomUUID(),
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`NiceHash ${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

// ── NiceHash response shapes (only the fields we use) ──────────────────
interface RigStat {
  speedAccepted?: number;
  speedRejectedTotal?: number;
  algorithm?: { enumName?: string };
}

interface Rig {
  rigId?: string;
  name?: string;
  minerStatus?: string;
  unpaidAmount?: string;
  stats?: RigStat[];
  statusTime?: number;
}

interface Rigs2Response {
  miningRigs?: Rig[];
  totalRigs?: number;
  minerStatuses?: Record<string, number>;
  unpaidAmount?: string;
}

interface AccountResponse {
  available?: string;
  totalBalance?: string;
}

// ── Normalized snapshot shared with the dashboard ──────────────────────
export interface Worker {
  id: string;
  name: string;
  status: 'online' | 'offline';
  hashrate: number;
  accepted: number;
  rejected: number;
  lastSeen: number;
  extra?: Array<{ label: string; value: string }>;
}

export interface Snapshot {
  status: 'live';
  stats: Array<{ label: string; value: string; accent?: boolean }>;
  workers: Worker[];
  totalHashrate: number;
  generatedAt: number;
}

function num(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

/** Fetch rigs + BTC balance and fold them into one normalized snapshot. */
export async function buildSnapshot(creds: NiceHashCreds): Promise<Snapshot> {
  const [rigs, account] = await Promise.all([
    get<Rigs2Response>(creds, '/main/api/v2/mining/rigs2'),
    get<AccountResponse>(creds, '/main/api/v2/accounting/account2/BTC').catch(
      () => ({} as AccountResponse),
    ),
  ]);

  const workers: Worker[] = (rigs.miningRigs ?? []).map((rig, i) => {
    const stats = rig.stats ?? [];
    const hashrate = stats.reduce((sum, s) => sum + num(s.speedAccepted), 0);
    const rejected = stats.reduce((sum, s) => sum + num(s.speedRejectedTotal), 0);
    const online = (rig.minerStatus ?? '').toUpperCase() === 'MINING';
    const algo = stats[0]?.algorithm?.enumName;
    return {
      id: `nicehash:${rig.rigId ?? i}`,
      name: rig.name ?? `rig ${i + 1}`,
      status: online ? 'online' : 'offline',
      hashrate,
      // NiceHash reports earnings, not accepted-share counts, per rig.
      accepted: 0,
      rejected,
      lastSeen: num(rig.statusTime) || Date.now(),
      extra: [
        ...(algo ? [{ label: 'Algorithm', value: algo }] : []),
        { label: 'Unpaid', value: `${num(rig.unpaidAmount).toFixed(8)} BTC` },
        { label: 'Miner status', value: rig.minerStatus ?? 'unknown' },
      ],
    };
  });

  const totalHashrate = workers.reduce((sum, w) => sum + w.hashrate, 0);
  const onlineCount = workers.filter((w) => w.status === 'online').length;
  const available = num(account.available);
  const totalUnpaid = num(rigs.unpaidAmount);

  return {
    status: 'live',
    stats: [
      { label: 'Total speed', value: `${totalHashrate.toFixed(2)} (NH units)`, accent: true },
      { label: 'Unpaid balance', value: `${totalUnpaid.toFixed(8)} BTC` },
      { label: 'Available BTC', value: `${available.toFixed(8)} BTC` },
      { label: 'Rigs mining', value: `${onlineCount} / ${workers.length}` },
    ],
    workers,
    totalHashrate,
    generatedAt: Date.now(),
  };
}
