use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde_json::json;
use tokio::time::sleep;
use tracing::{debug, info, warn};

use crate::config::Config;
use crate::stats::Stats;

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(5);

/// Register with the monitoring server and push heartbeats forever. Failures
/// are logged and retried; they never interrupt mining.
pub async fn run(config: Config, stats: Arc<Stats>, threads: usize) {
    if config.server_url.trim().is_empty() {
        info!("monitoring server reporting disabled");
        return;
    }

    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            warn!("could not build HTTP client, reporting disabled: {e}");
            return;
        }
    };
    let base = config.server_url.trim_end_matches('/').to_string();
    let worker_id = register(&client, &base, &config, threads).await;

    let mut prev_hashes = stats.hashes.load(Ordering::Relaxed);
    let mut prev = Instant::now();

    loop {
        sleep(HEARTBEAT_INTERVAL).await;

        let now = Instant::now();
        let total = stats.hashes.load(Ordering::Relaxed);
        let dt = now.duration_since(prev).as_secs_f64().max(0.001);
        let hashrate = total.saturating_sub(prev_hashes) as f64 / dt;
        prev_hashes = total;
        prev = now;

        let body = json!({
            "hashrate": hashrate,
            "accepted": stats.accepted.load(Ordering::Relaxed),
            "rejected": stats.rejected.load(Ordering::Relaxed),
            "uptimeSeconds": stats.uptime_secs(),
        });
        let url = format!("{base}/api/workers/{worker_id}/heartbeat");
        match client.post(&url).json(&body).send().await {
            Ok(r) if r.status().is_success() => debug!(hashrate, "heartbeat sent"),
            Ok(r) => warn!("heartbeat rejected by server: HTTP {}", r.status()),
            Err(e) => warn!("heartbeat request failed: {e}"),
        }
    }
}

async fn register(
    client: &reqwest::Client,
    base: &str,
    config: &Config,
    threads: usize,
) -> String {
    let body = json!({
        "name": config.worker_name,
        "host": hostname(),
        "threads": threads,
        "pool": config.pool_url,
    });
    let url = format!("{base}/api/workers/register");

    loop {
        match client.post(&url).json(&body).send().await {
            Ok(r) if r.status().is_success() => {
                match r.json::<serde_json::Value>().await {
                    Ok(v) => {
                        if let Some(id) = v.get("id").and_then(|i| i.as_str()) {
                            info!(worker_id = id, "registered with monitoring server");
                            return id.to_string();
                        }
                        warn!("register response missing id field");
                    }
                    Err(e) => warn!("could not parse register response: {e}"),
                }
            }
            Ok(r) => warn!("register rejected by server: HTTP {}", r.status()),
            Err(e) => warn!("register request failed: {e}"),
        }
        sleep(HEARTBEAT_INTERVAL).await;
    }
}

fn hostname() -> String {
    std::env::var("HOSTNAME")
        .ok()
        .or_else(|| {
            std::fs::read_to_string("/etc/hostname")
                .ok()
                .map(|s| s.trim().to_string())
        })
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "unknown".to_string())
}
