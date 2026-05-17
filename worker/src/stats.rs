use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

/// Process-wide mining counters shared between the miner threads, the stratum
/// client and the reporter.
pub struct Stats {
    pub hashes: AtomicU64,
    pub accepted: AtomicU64,
    pub rejected: AtomicU64,
    started: Instant,
}

impl Stats {
    pub fn new() -> Self {
        Self {
            hashes: AtomicU64::new(0),
            accepted: AtomicU64::new(0),
            rejected: AtomicU64::new(0),
            started: Instant::now(),
        }
    }

    pub fn add_hashes(&self, n: u64) {
        self.hashes.fetch_add(n, Ordering::Relaxed);
    }

    pub fn add_accepted(&self) {
        self.accepted.fetch_add(1, Ordering::Relaxed);
    }

    pub fn add_rejected(&self) {
        self.rejected.fetch_add(1, Ordering::Relaxed);
    }

    pub fn uptime_secs(&self) -> u64 {
        self.started.elapsed().as_secs()
    }
}
