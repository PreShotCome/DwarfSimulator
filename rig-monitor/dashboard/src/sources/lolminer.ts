import {
  placeholderSnapshot,
  type Source,
  type SourceConfig,
  type SourceSnapshot,
} from './types';

/**
 * "Rig (live)" source — real-time stats straight from lolMiner's local API,
 * read through the server proxy (which runs on the rig and reaches lolMiner over
 * localhost). This shows your *true* hashrate, temp and watts, instead of the
 * pool's delayed share-based estimate. Reading it uses no GPU, so it's safe to
 * watch from your phone while the rig mines undisturbed.
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
    const res = await fetch(`${proxyUrl}/api/lolminer/snapshot`);
    if (res.status === 501) {
      return placeholderSnapshot(
        'unconfigured',
        "lolMiner's API isn't reachable. Launch lolMiner with --apiport 4444, and make sure the proxy (rig-monitor/server) is running.",
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
  tagline: 'Real-time hashrate, temp & watts from lolMiner',
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
