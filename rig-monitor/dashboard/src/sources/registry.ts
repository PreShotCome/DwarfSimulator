import type { Source } from './types';
import { nicehashSource } from './nicehash';
import { ergoSource } from './ergo';

/**
 * Every miner the dashboard can show, in switcher order. NiceHash is first so
 * it is the default profile on first run. Add a new miner by writing one
 * adapter file and appending it here — nothing else needs to change.
 */
export const SOURCES: Source[] = [nicehashSource, ergoSource];

/** The id selected on first run (before the user picks one). */
export const DEFAULT_SOURCE_ID = nicehashSource.id;

export function getSource(id: string): Source {
  return SOURCES.find((s) => s.id === id) ?? SOURCES[0];
}
