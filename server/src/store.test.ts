import { describe, expect, it } from 'vitest';
import { Store } from './store';

const TIMEOUT = 10_000;

function freshStore(): Store {
  return new Store(':memory:', TIMEOUT);
}

function register(store: Store, name = 'rig') {
  return store.registerWorker({ name, host: 'localhost', threads: 4, pool: 'pool:3333' });
}

describe('Store', () => {
  it('registers a worker and reads it back', () => {
    const store = freshStore();
    const worker = register(store, 'alpha');
    expect(worker.id).toBeTruthy();
    expect(worker.status).toBe('online');
    expect(store.getWorker(worker.id)?.name).toBe('alpha');
    store.close();
  });

  it('applies heartbeats and records history', () => {
    const store = freshStore();
    const worker = register(store);
    const updated = store.heartbeat(worker.id, {
      hashrate: 1234,
      accepted: 3,
      rejected: 1,
      uptimeSeconds: 60,
    });
    expect(updated?.hashrate).toBe(1234);
    expect(updated?.accepted).toBe(3);
    expect(store.getHistory(worker.id, 0)).toHaveLength(1);
    store.close();
  });

  it('rejects heartbeats for unknown workers', () => {
    const store = freshStore();
    expect(
      store.heartbeat('does-not-exist', {
        hashrate: 1,
        accepted: 0,
        rejected: 0,
        uptimeSeconds: 0,
      }),
    ).toBeNull();
    store.close();
  });

  it('aggregates a fleet summary across workers', () => {
    const store = freshStore();
    const a = register(store, 'a');
    const b = register(store, 'b');
    store.heartbeat(a.id, { hashrate: 100, accepted: 5, rejected: 1, uptimeSeconds: 10 });
    store.heartbeat(b.id, { hashrate: 250, accepted: 7, rejected: 0, uptimeSeconds: 10 });
    const summary = store.summary();
    expect(summary.workerCount).toBe(2);
    expect(summary.onlineCount).toBe(2);
    expect(summary.totalHashrate).toBe(350);
    expect(summary.totalAccepted).toBe(12);
    expect(summary.totalRejected).toBe(1);
    store.close();
  });

  it('marks a worker offline once its heartbeat lapses', () => {
    const store = new Store(':memory:', -1); // negative timeout => instantly stale
    const worker = register(store);
    expect(store.getWorker(worker.id)?.status).toBe('offline');
    expect(store.markStale()).toBe(1);
    expect(store.markStale()).toBe(0); // idempotent once transitioned
    store.close();
  });

  it('emits a change event on registration and heartbeat', () => {
    const store = freshStore();
    let changes = 0;
    store.on('change', () => {
      changes += 1;
    });
    const worker = register(store);
    store.heartbeat(worker.id, { hashrate: 1, accepted: 0, rejected: 0, uptimeSeconds: 1 });
    expect(changes).toBe(2);
    store.close();
  });
});
