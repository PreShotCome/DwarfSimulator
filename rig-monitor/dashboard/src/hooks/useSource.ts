import { useEffect, useRef, useState } from 'react';
import { getSource } from '../sources/registry';
import type { SourceConfig, SourceSnapshot } from '../sources/types';

export interface Sample {
  ts: number;
  hashrate: number;
}

export interface SourceState {
  snapshot: SourceSnapshot | null;
  /** Rolling hash-rate history for the active source (built client-side). */
  history: Sample[];
  /** True once at least one live snapshot has arrived. */
  loaded: boolean;
}

const POLL_MS = 15_000;
const HISTORY_MS = 60 * 60 * 1000; // keep ~1 hour of samples

/**
 * Polls the active source on an interval and keeps a client-side hash-rate
 * history (pool/proxy APIs return snapshots, not time series, so we build the
 * trend ourselves). History resets whenever the active source changes.
 */
export function useSource(sourceId: string, config: SourceConfig): SourceState {
  const [snapshot, setSnapshot] = useState<SourceSnapshot | null>(null);
  const [history, setHistory] = useState<Sample[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Serialize config so the effect re-runs when the user edits settings.
  const configKey = JSON.stringify(config);
  const historyRef = useRef<Sample[]>([]);

  useEffect(() => {
    let disposed = false;
    // New source (or new config): start a fresh history buffer.
    historyRef.current = [];
    setHistory([]);
    setSnapshot(null);
    setLoaded(false);

    const source = getSource(sourceId);

    const tick = async (): Promise<void> => {
      const snap = await source.fetchSnapshot(config);
      if (disposed) return;
      setSnapshot(snap);
      setLoaded(true);
      if (snap.status === 'live') {
        const cutoff = Date.now() - HISTORY_MS;
        const next = [
          ...historyRef.current.filter((s) => s.ts >= cutoff),
          { ts: snap.generatedAt, hashrate: snap.totalHashrate },
        ];
        historyRef.current = next;
        setHistory(next);
      }
    };

    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, configKey]);

  return { snapshot, history, loaded };
}
