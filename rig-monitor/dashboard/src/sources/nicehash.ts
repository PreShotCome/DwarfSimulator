import {
  placeholderSnapshot,
  type Source,
  type SourceConfig,
  type SourceSnapshot,
} from './types';

/**
 * NiceHash source — SCAFFOLD (default miner once wired).
 *
 * NiceHash's API requires HMAC-signed requests using your API key + secret +
 * organization id. Those secrets must NEVER live in a browser app, and the
 * NiceHash API also blocks cross-origin browser requests. So this adapter does
 * not talk to NiceHash directly: it reads from the small server proxy in
 * `rig-monitor/server`, which holds the keys (server-side env vars) and returns
 * an already-normalized SourceSnapshot.
 *
 * To go live:
 *   1. cd rig-monitor/server && npm install
 *   2. set NICEHASH_API_KEY / NICEHASH_API_SECRET / NICEHASH_ORG_ID
 *   3. npm run dev   (defaults to http://localhost:4100)
 *   4. set this source's "Proxy URL" to that address in dashboard settings.
 */

// Default the proxy to whatever host serves this page: 'localhost' on the rig,
// or the rig's LAN IP when the dashboard is opened from a phone.
const DEFAULT_PROXY =
  typeof location !== 'undefined'
    ? `http://${location.hostname}:4100`
    : 'http://localhost:4100';

async function fetchSnapshot(config: SourceConfig): Promise<SourceSnapshot> {
  const proxyUrl = (config.proxyUrl || DEFAULT_PROXY).trim().replace(/\/$/, '');
  if (!proxyUrl) {
    return placeholderSnapshot(
      'unconfigured',
      'NiceHash needs the server proxy (it holds your API keys). Start rig-monitor/server, then set its Proxy URL here. See the README.',
    );
  }

  try {
    const res = await fetch(`${proxyUrl}/api/nicehash/snapshot`);
    if (res.status === 501) {
      return placeholderSnapshot(
        'unconfigured',
        'Proxy is running but NiceHash keys are not set. Add NICEHASH_API_KEY / SECRET / ORG_ID to the server env.',
      );
    }
    if (!res.ok) {
      return placeholderSnapshot('error', `Proxy returned ${res.status}.`);
    }
    // The proxy already returns a normalized SourceSnapshot.
    const snapshot = (await res.json()) as SourceSnapshot;
    return { ...snapshot, generatedAt: Date.now() };
  } catch {
    return placeholderSnapshot(
      'error',
      `Could not reach the proxy at ${proxyUrl}. Is rig-monitor/server running?`,
    );
  }
}

export const nicehashSource: Source = {
  id: 'nicehash',
  label: 'NiceHash',
  emoji: '⚡',
  accent: '#f9a23b',
  coinUnit: 'BTC',
  tagline: 'Sell hashpower, stack BTC · auto profit-switching',
  configFields: [
    {
      key: 'proxyUrl',
      label: 'Proxy URL',
      placeholder: DEFAULT_PROXY,
      help: 'Address of rig-monitor/server, which signs NiceHash API calls server-side. Keys are set as env vars on the server, never here.',
    },
  ],
  fetchSnapshot,
};
