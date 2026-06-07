/**
 * The source-adapter layer. Each "miner" the dashboard can show — NiceHash,
 * Ergo, a custom pool — is a {@link Source}. A Source knows how to turn its
 * own remote API into one normalized {@link SourceSnapshot}, so every visual
 * component renders identically regardless of which miner is active. Swapping
 * the active Source is what gives the "switch accounts, whole view changes"
 * feel: the headline stats, worker cards, coin unit and accent colour all
 * follow from the snapshot the active Source returns.
 */

export type WorkerStatus = 'online' | 'offline';

/** One mining worker (a rig, or a pool sub-worker), normalized across sources. */
export interface Worker {
  /** Stable id, unique within the source (used as React key + detail lookup). */
  id: string;
  name: string;
  status: WorkerStatus;
  /** Current hash rate in H/s. */
  hashrate: number;
  /** Valid shares (or accepted units) reported so far. */
  accepted: number;
  /** Stale / invalid shares. */
  rejected: number;
  /** Epoch ms the worker was last seen. */
  lastSeen: number;
  /** Extra rows shown on the card/detail — source-specific, label → value. */
  extra?: Array<{ label: string; value: string }>;
}

/** A headline stat rendered in the top summary bar. Sources choose their own. */
export interface StatCard {
  label: string;
  value: string;
  /** Render in the source's accent colour (used for the marquee metric). */
  accent?: boolean;
}

export type SourceStatus = 'live' | 'loading' | 'unconfigured' | 'error';

/** Everything the dashboard needs to render one miner at one moment. */
export interface SourceSnapshot {
  status: SourceStatus;
  /** Headline cards for the summary bar (hashrate, balance, profit, ...). */
  stats: StatCard[];
  workers: Worker[];
  /** Aggregate hash rate (H/s) used for the trend chart. */
  totalHashrate: number;
  /** Human-readable note for unconfigured/error states. */
  message?: string;
  generatedAt: number;
}

/** A single field the user fills in to configure a source (e.g. wallet). */
export interface ConfigField {
  key: string;
  label: string;
  placeholder?: string;
  /** Masked input + never logged. Secrets should live server-side; see README. */
  secret?: boolean;
  help?: string;
}

/** Per-source config the user has entered, persisted in localStorage. */
export type SourceConfig = Record<string, string>;

/** Static descriptor + data adapter for one miner. */
export interface Source {
  id: string;
  /** Display name in the switcher. */
  label: string;
  /** Single emoji used as the source "avatar" in the switcher. */
  emoji: string;
  /** Accent colour (hex) applied to the whole view when this source is active. */
  accent: string;
  /** What you're accumulating, e.g. 'BTC' or 'ERG'. */
  coinUnit: string;
  /** One-line description shown in the switcher dropdown. */
  tagline: string;
  /** Fields the user must fill in for this source to go live. */
  configFields: ConfigField[];
  /**
   * Fetch a fresh snapshot. Implementations must resolve (never throw) — map
   * failures to a snapshot with status 'error' or 'unconfigured' and a message.
   */
  fetchSnapshot(config: SourceConfig): Promise<SourceSnapshot>;
}

/** Helper for adapters: an empty/placeholder snapshot in a non-live state. */
export function placeholderSnapshot(
  status: SourceStatus,
  message: string,
): SourceSnapshot {
  return {
    status,
    stats: [],
    workers: [],
    totalHashrate: 0,
    message,
    generatedAt: Date.now(),
  };
}
