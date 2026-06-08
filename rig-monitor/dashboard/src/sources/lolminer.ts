import {
  placeholderSnapshot,
  type Source,
  type SourceConfig,
  type SourceSnapshot,
} from './types';

/**
 * "Rig (live)" source — real-time hardware stats straight from the local miner,
 * read through the server proxy (which runs on the rig over localhost). The
 * proxy auto-detects whichever miner is running: lolMiner (Ergo) or NiceHash's
 * Excavator. Shows your *true* hashrate, temp and watts, not the pool's delayed
 * estimate. Reading it uses no GPU, so it's safe to watch from your phone.
 */

// Default the proxy to whatever host is serving this page: 'localhost' on the
// rig, or the rig's LAN IP when you open the dashboard from your phone.
const DEFAULT_PROXY =
  typeof location !== 'undefined'
    ? `http://${location.hostname}:4100`
    : 'http://localhost:4100';

async function fetchSnapshot(config: SourceConfig): Promise<SourceSnapshot> {
  const proxyUrl = (config.proxyUrl || DEFAULT_PROXY).trim().replace(/\/$/, '');
  try {
    const res = await fetch(`${proxyUrl}/api/rig/snapshot`);
    if (res.status === 501) {
      return placeholderSnapshot(
        'unconfigured',
        "No local miner detected. Start a miner (lolMiner with --apiport 4444, or NiceHash QuickMiner) and make sure the proxy is running.",
      );
    }
    if (!res.ok) {
      return placeholderSnapshot('error', `Proxy returned ${res.status}.`);
    }
    const snapshot = (await res.json()) as SourceSnapshot;
    return { ...snapshot, generatedAt: Date.now() };
  } catch {
    return placeholderSnapshot(
      'error',
      `Could not reach the proxy at ${proxyUrl}. Is rig-monitor/server running?`,
    );
  }
}

export const lolminerSource: Source = {
  id: 'lolminer',
  label: 'Rig (live)',
  emoji: '🖥️',
  accent: '#3da5ff',
  coinUnit: '',
  tagline: 'Real-time hardware — auto-detects lolMiner or NiceHash',
  configFields: [
    {
      key: 'proxyUrl',
      label: 'Proxy URL',
      placeholder: DEFAULT_PROXY,
      help: "Address of rig-monitor/server, which reads lolMiner's local API. Defaults to this page's host, so it works from the rig or your phone.",
    },
  ],
  fetchSnapshot,
};
