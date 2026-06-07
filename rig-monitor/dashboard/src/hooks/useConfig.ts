import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SOURCE_ID } from '../sources/registry';
import type { SourceConfig } from '../sources/types';

/**
 * Persists the active source and each source's config in localStorage, so the
 * chosen "profile" and its settings survive reloads — like staying signed into
 * the last account you used.
 */

const ACTIVE_KEY = 'rigmon.activeSource';
const CONFIG_KEY = 'rigmon.config';

type ConfigMap = Record<string, SourceConfig>;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useConfig() {
  const [activeId, setActiveId] = useState<string>(() =>
    readJson<string>(ACTIVE_KEY, DEFAULT_SOURCE_ID),
  );
  const [configs, setConfigs] = useState<ConfigMap>(() =>
    readJson<ConfigMap>(CONFIG_KEY, {}),
  );

  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(activeId));
  }, [activeId]);

  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(configs));
  }, [configs]);

  const setConfig = useCallback((sourceId: string, config: SourceConfig) => {
    setConfigs((prev) => ({ ...prev, [sourceId]: config }));
  }, []);

  const configFor = useCallback(
    (sourceId: string): SourceConfig => configs[sourceId] ?? {},
    [configs],
  );

  return { activeId, setActiveId, configFor, setConfig };
}
