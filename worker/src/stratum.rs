use std::sync::Arc;
use std::time::Duration;

use anyhow::{anyhow, Result};
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::sync::mpsc::Receiver;
use tokio::time::sleep;
use tracing::{info, warn};

use crate::config::Config;
use crate::job::{target_to_u64, Job};
use crate::miner::{build_cache, WorkContext};
use crate::stats::Stats;
use crate::{Share, SharedWork};

const RECONNECT_DELAY: Duration = Duration::from_secs(5);

/// Connect to the pool and keep a session alive, reconnecting on any failure.
pub async fn run(
    config: Config,
    shared: SharedWork,
    stats: Arc<Stats>,
    mut share_rx: Receiver<Share>,
) -> Result<()> {
    loop {
        if let Err(e) = session(&config, &shared, &stats, &mut share_rx).await {
            warn!("stratum session ended: {e}");
        }
        info!("reconnecting to pool in {}s", RECONNECT_DELAY.as_secs());
        sleep(RECONNECT_DELAY).await;
    }
}

async fn session(
    config: &Config,
    shared: &SharedWork,
    stats: &Arc<Stats>,
    share_rx: &mut Receiver<Share>,
) -> Result<()> {
    info!(pool = %config.pool_url, "connecting to pool");
    let stream = TcpStream::connect(&config.pool_url)
        .await
        .map_err(|e| anyhow!("connect {}: {e}", config.pool_url))?;
    stream.set_nodelay(true).ok();
    let (read_half, mut write_half) = stream.into_split();
    let mut reader = BufReader::new(read_half);

    let login = json!({
        "id": 1,
        "jsonrpc": "2.0",
        "method": "login",
        "params": {
            "login": config.wallet_address,
            "pass": config.pool_pass,
            "agent": concat!("monero-worker/", env!("CARGO_PKG_VERSION")),
            "rigid": config.worker_name,
        }
    });
    send(&mut write_half, &login).await?;

    let mut session_id = String::new();
    let mut next_id = 2u64;
    let mut line = String::new();

    loop {
        tokio::select! {
            read = read_line(&mut reader, &mut line) => {
                if read? == 0 {
                    return Err(anyhow!("pool closed the connection"));
                }
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                match serde_json::from_str::<Value>(trimmed) {
                    Ok(msg) => handle_message(&msg, &mut session_id, shared, stats).await?,
                    Err(e) => warn!("ignoring malformed pool message: {e}"),
                }
            }
            share = share_rx.recv() => {
                let Some(share) = share else {
                    return Err(anyhow!("share channel closed"));
                };
                if session_id.is_empty() {
                    continue; // not authorized yet; drop the stale share.
                }
                let submit = json!({
                    "id": next_id,
                    "jsonrpc": "2.0",
                    "method": "submit",
                    "params": {
                        "id": session_id,
                        "job_id": share.job_id,
                        "nonce": hex::encode(share.nonce.to_le_bytes()),
                        "result": share.result,
                    }
                });
                next_id += 1;
                send(&mut write_half, &submit).await?;
            }
        }
    }
}

async fn handle_message(
    msg: &Value,
    session_id: &mut String,
    shared: &SharedWork,
    stats: &Arc<Stats>,
) -> Result<()> {
    // Pool-initiated notifications carry a "method".
    if let Some(method) = msg.get("method").and_then(Value::as_str) {
        if method == "job" {
            if let Some(params) = msg.get("params") {
                apply_job(params, shared).await?;
            }
        }
        return Ok(());
    }

    if let Some(err) = msg.get("error") {
        if !err.is_null() {
            warn!("pool returned error: {err}");
            stats.add_rejected();
            return Ok(());
        }
    }

    let Some(result) = msg.get("result").filter(|r| !r.is_null()) else {
        return Ok(());
    };

    if let Some(id) = result.get("id").and_then(Value::as_str) {
        // Response to the login request.
        *session_id = id.to_string();
        info!("authorized with pool");
        if let Some(job) = result.get("job") {
            apply_job(job, shared).await?;
        }
    } else if let Some(status) = result.get("status").and_then(Value::as_str) {
        // Response to a share submission.
        if status.eq_ignore_ascii_case("OK") {
            stats.add_accepted();
            info!("share accepted");
        } else {
            stats.add_rejected();
            warn!("share rejected: {status}");
        }
    }
    Ok(())
}

async fn apply_job(params: &Value, shared: &SharedWork) -> Result<()> {
    let job: Job =
        serde_json::from_value(params.clone()).map_err(|e| anyhow!("invalid job: {e}"))?;
    let target = target_to_u64(&job.target)?;
    let seed = hex::decode(job.seed_hash.trim()).unwrap_or_default();

    let need_rebuild = {
        let guard = shared.lock().unwrap();
        match guard.as_ref() {
            Some(ctx) => ctx.seed != seed,
            None => true,
        }
    };

    let cache = if need_rebuild {
        let seed = seed.clone();
        tokio::task::spawn_blocking(move || build_cache(&seed)).await??
    } else {
        shared.lock().unwrap().as_ref().unwrap().cache.clone()
    };

    let mut guard = shared.lock().unwrap();
    let version = guard.as_ref().map(|c| c.version + 1).unwrap_or(1);
    info!(job = %job.job_id, height = job.height, "received job");
    *guard = Some(WorkContext {
        job,
        target,
        version,
        seed,
        cache,
    });
    Ok(())
}

async fn send<W>(writer: &mut W, value: &Value) -> Result<()>
where
    W: AsyncWriteExt + Unpin,
{
    let mut payload = serde_json::to_string(value)?;
    payload.push('\n');
    writer.write_all(payload.as_bytes()).await?;
    writer.flush().await?;
    Ok(())
}

async fn read_line<R>(reader: &mut R, buf: &mut String) -> Result<usize>
where
    R: AsyncBufReadExt + Unpin,
{
    buf.clear();
    Ok(reader.read_line(buf).await?)
}
