mod config;
mod job;
mod miner;
mod reporter;
mod stats;
mod stratum;

use std::sync::{Arc, Mutex};

use anyhow::Result;
use clap::Parser;
use tokio::sync::mpsc;
use tracing::info;
use tracing_subscriber::EnvFilter;

use config::Config;
use miner::WorkContext;
use stats::Stats;

/// Shared mining context: the latest job plus its RandomX cache.
pub type SharedWork = Arc<Mutex<Option<WorkContext>>>;

/// A solved share found by a miner thread, awaiting submission to the pool.
#[derive(Debug, Clone)]
pub struct Share {
    pub job_id: String,
    pub nonce: u32,
    pub result: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let config = Config::parse();
    let threads = config.thread_count();
    info!(
        pool = %config.pool_url,
        worker = %config.worker_name,
        threads,
        "starting monero-worker"
    );

    let shared: SharedWork = Arc::new(Mutex::new(None));
    let stats = Arc::new(Stats::new());
    let (share_tx, share_rx) = mpsc::channel::<Share>(256);

    miner::spawn_miners(threads, shared.clone(), stats.clone(), share_tx);
    tokio::spawn(reporter::run(config.clone(), stats.clone(), threads));

    stratum::run(config, shared, stats, share_rx).await
}
