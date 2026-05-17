export type WorkerStatus = 'online' | 'offline';

/** A miner instance and its most recent reported stats. */
export interface Worker {
  id: string;
  name: string;
  host: string;
  threads: number;
  pool: string;
  createdAt: number;
  lastSeen: number;
  status: WorkerStatus;
  hashrate: number;
  accepted: number;
  rejected: number;
  uptimeSeconds: number;
}

/** A single historical stats reading for one worker. */
export interface Sample {
  ts: number;
  hashrate: number;
  accepted: number;
  rejected: number;
  uptimeSeconds: number;
}

/** Fleet-wide aggregate across all known workers. */
export interface Summary {
  workerCount: number;
  onlineCount: number;
  totalHashrate: number;
  totalAccepted: number;
  totalRejected: number;
}
