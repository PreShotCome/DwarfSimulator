use clap::Parser;

/// Runtime configuration, populated from CLI flags or environment variables.
#[derive(Parser, Debug, Clone)]
#[command(name = "monero-worker", about = "Monero RandomX CPU miner")]
pub struct Config {
    /// Mining pool address as host:port (Monero stratum).
    #[arg(long, env = "POOL_URL", default_value = "127.0.0.1:3333")]
    pub pool_url: String,

    /// Monero wallet address used as the pool login.
    #[arg(long, env = "WALLET_ADDRESS", default_value = "demo-wallet")]
    pub wallet_address: String,

    /// Pool password (most pools accept "x").
    #[arg(long, env = "POOL_PASS", default_value = "x")]
    pub pool_pass: String,

    /// Human-readable name for this worker / rig.
    #[arg(long, env = "WORKER_NAME", default_value = "worker-1")]
    pub worker_name: String,

    /// Number of mining threads (0 = one per logical CPU).
    #[arg(long, env = "THREADS", default_value_t = 0)]
    pub threads: usize,

    /// Monitoring server base URL. Set empty to disable reporting.
    #[arg(long, env = "SERVER_URL", default_value = "http://127.0.0.1:4000")]
    pub server_url: String,
}

impl Config {
    /// Effective mining thread count, resolving 0 to the CPU count.
    pub fn thread_count(&self) -> usize {
        if self.threads == 0 {
            std::thread::available_parallelism()
                .map(|n| n.get())
                .unwrap_or(1)
        } else {
            self.threads
        }
    }
}
