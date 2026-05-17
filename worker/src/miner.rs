use std::sync::Arc;
use std::thread;
use std::time::Duration;

use randomx_rs::{RandomXCache, RandomXFlag, RandomXVM};
use tokio::sync::mpsc::Sender;
use tracing::{info, warn};

use crate::job::{hash_meets_target, target_difficulty, Job, NONCE_OFFSET};
use crate::stats::Stats;
use crate::{Share, SharedWork};

/// Hashes computed between each check for a fresh job.
const BATCH: u32 = 16;

/// A RandomX cache wrapped so it can be shared across threads. The cache is
/// immutable once built and RandomX supports using one cache from many VMs
/// concurrently, so sharing it read-only between threads is sound.
#[derive(Clone)]
pub struct SyncCache(RandomXCache);

// SAFETY: see the doc comment above; the wrapped cache is read-only after
// construction and RandomX permits concurrent use across threads.
unsafe impl Send for SyncCache {}
unsafe impl Sync for SyncCache {}

/// The current job plus the RandomX cache derived from its seed hash.
pub struct WorkContext {
    pub job: Job,
    pub target: u64,
    pub version: u64,
    pub seed: Vec<u8>,
    pub cache: SyncCache,
}

fn flags() -> RandomXFlag {
    RandomXFlag::get_recommended_flags()
}

/// Build a RandomX cache for the given seed, falling back to the portable
/// (no-JIT) configuration if the recommended flags are unavailable.
pub fn build_cache(seed: &[u8]) -> anyhow::Result<SyncCache> {
    let cache = RandomXCache::new(flags(), seed)
        .or_else(|_| RandomXCache::new(RandomXFlag::FLAG_DEFAULT, seed))
        .map_err(|e| anyhow::anyhow!("RandomX cache init failed: {e}"))?;
    Ok(SyncCache(cache))
}

fn create_vm(cache: &SyncCache) -> anyhow::Result<RandomXVM> {
    RandomXVM::new(flags(), Some(cache.0.clone()), None)
        .or_else(|_| RandomXVM::new(RandomXFlag::FLAG_DEFAULT, Some(cache.0.clone()), None))
        .map_err(|e| anyhow::anyhow!("RandomX VM init failed: {e}"))
}

/// Disjoint nonce range assigned to a thread so threads do not duplicate work.
fn nonce_span(tid: usize, total: usize) -> (u32, u32) {
    let chunk = u32::MAX / total.max(1) as u32;
    let start = chunk.wrapping_mul(tid as u32);
    let end = if tid + 1 == total {
        u32::MAX
    } else {
        start.wrapping_add(chunk)
    };
    (start, end)
}

/// Spawn one OS thread per mining slot. Threads are CPU-bound, so they run
/// outside the async runtime.
pub fn spawn_miners(
    threads: usize,
    shared: SharedWork,
    stats: Arc<Stats>,
    share_tx: Sender<Share>,
) {
    for tid in 0..threads {
        let shared = shared.clone();
        let stats = stats.clone();
        let tx = share_tx.clone();
        thread::Builder::new()
            .name(format!("miner-{tid}"))
            .spawn(move || mine_thread(tid, threads, shared, stats, tx))
            .expect("failed to spawn miner thread");
    }
}

fn mine_thread(
    tid: usize,
    total: usize,
    shared: SharedWork,
    stats: Arc<Stats>,
    share_tx: Sender<Share>,
) {
    let span = nonce_span(tid, total);
    let mut nonce = span.0;
    let mut version = u64::MAX;
    let mut vm: Option<RandomXVM> = None;
    let mut blob: Vec<u8> = Vec::new();
    let mut target = 0u64;
    let mut job_id = String::new();

    loop {
        // Pick up a fresh job if the shared context advanced.
        let refreshed = {
            let guard = shared.lock().unwrap();
            match guard.as_ref() {
                Some(ctx) if ctx.version != version => Some((
                    ctx.version,
                    ctx.job.clone(),
                    ctx.target,
                    ctx.cache.clone(),
                )),
                _ => None,
            }
        };

        if let Some((v, job, t, cache)) = refreshed {
            version = v;
            target = t;
            job_id = job.job_id.clone();
            blob = hex::decode(&job.blob).unwrap_or_default();
            nonce = span.0;
            vm = match create_vm(&cache) {
                Ok(vm) => Some(vm),
                Err(e) => {
                    warn!("thread {tid}: {e}");
                    None
                }
            };
            if tid == 0 {
                info!(
                    job = %job_id,
                    difficulty = target_difficulty(target),
                    "mining new job"
                );
            }
        }

        let Some(vm) = vm.as_ref() else {
            thread::sleep(Duration::from_millis(250));
            continue;
        };
        if blob.len() < NONCE_OFFSET + 4 {
            thread::sleep(Duration::from_millis(250));
            continue;
        }

        let mut hashed = 0u64;
        for _ in 0..BATCH {
            blob[NONCE_OFFSET..NONCE_OFFSET + 4].copy_from_slice(&nonce.to_le_bytes());
            match vm.calculate_hash(&blob) {
                Ok(hash) => {
                    hashed += 1;
                    if hash_meets_target(&hash, target) {
                        let share = Share {
                            job_id: job_id.clone(),
                            nonce,
                            result: hex::encode(&hash),
                        };
                        if share_tx.blocking_send(share).is_err() {
                            return; // stratum side gone; shut the thread down.
                        }
                    }
                }
                Err(e) => warn!("thread {tid}: hash error: {e}"),
            }
            nonce = if nonce >= span.1 {
                span.0
            } else {
                nonce.wrapping_add(1)
            };
        }
        stats.add_hashes(hashed);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nonce_spans_cover_range_without_overlap() {
        let (s0, e0) = nonce_span(0, 4);
        let (s1, _) = nonce_span(1, 4);
        assert_eq!(s0, 0);
        assert_eq!(e0, s1);
    }

    #[test]
    fn randomx_official_test_vector() {
        // Canonical RandomX vector: key "test key 000", input "This is a test".
        let cache = build_cache(b"test key 000").expect("cache");
        let vm = create_vm(&cache).expect("vm");
        let hash = vm.calculate_hash(b"This is a test").expect("hash");
        assert_eq!(
            hex::encode(hash),
            "639183aae1bf4c9a35884cb46b09cad9175f04efd7684e7262a0ac1c2f0b4e3f"
        );
    }
}
