# Monero Mining App

A real Monero (XMR) CPU miner plus a live monitoring dashboard, in one
monorepo. A worker mines with RandomX, reports its stats to a server, and a
web dashboard shows every worker in one view.

```
worker (Rust)  ──mines──▶  pool (real, or bundled mock)
      │
      └──heartbeats──▶  server (Node/TS, REST + WebSocket + SQLite)
                              │
                              └──live feed──▶  dashboard (React PWA)
```

## Read this first — honest expectations

- **Monero uses RandomX, an algorithm designed to run on CPUs**, so a CPU
  miner does real, valid work — unlike Bitcoin, which is ASIC-only.
- **Earnings are small.** A typical desktop CPU earns on the order of cents
  per day *before electricity*. At normal residential power rates the result
  is often break-even or a small loss. Use a real power meter and your kWh
  rate to decide whether running it is worth it.
- **Only mine on electricity you pay for or are explicitly authorized to
  use.** Running a miner on an employer's or a property's power without the
  owner's permission is theft and can get you fired or prosecuted.
- **This worker uses RandomX light mode.** It is correct and mines real
  shares, but its hash rate is lower than a heavily tuned miner such as XMRig.
  Per-hash earnings are identical; only throughput differs.

## Repository layout

| Path         | Stack            | Purpose                                            |
|--------------|------------------|----------------------------------------------------|
| `worker/`    | Rust             | RandomX CPU miner + Monero stratum client          |
| `server/`    | Node / TypeScript| Aggregates worker stats; REST + WebSocket; SQLite  |
| `dashboard/` | React + Vite     | Installable PWA showing all workers live           |
| `mock-pool/` | Node / TypeScript| Minimal mock Monero pool for zero-config local runs|

## Quick start (Docker — recommended)

Requires Docker with Compose.

```bash
docker compose up --build
```

This starts the mock pool, the server, the dashboard, and one worker mining
against the mock pool. Then open:

- **Dashboard:** http://localhost:8080
- **Server API:** http://localhost:4000/health

You should see `docker-worker-1` appear within a few seconds, its hash rate
climb above zero, and accepted shares accumulate.

Stop with `Ctrl+C`; `docker compose down` removes the containers. Stats
history is kept in the `monitor-data` volume.

## Quick start (native)

Prerequisites: Node.js 20+, Rust (stable), and a C++ toolchain with CMake
(`cmake`, `make`, `g++` / `build-essential`) — the latter is required to
build the bundled RandomX library.

In separate terminals:

```bash
# 1. Install JS dependencies (once)
npm run install:all

# 2. Mock pool + server + dashboard together
npm run dev

# 3. The worker (Rust)
cd worker
cargo run --release
```

Defaults make the worker connect to the local mock pool (`127.0.0.1:3333`)
and report to the local server (`http://127.0.0.1:4000`). The dashboard dev
server runs at http://localhost:5173.

## Running multiple workers

Each worker is an independent process — run as many as you like, on one
machine or across several devices, and they all appear on the dashboard.
Give each a unique name:

```bash
# native
WORKER_NAME=living-room-pc cargo run --release
WORKER_NAME=laptop SERVER_URL=http://192.168.1.10:4000 cargo run --release

# docker: scale the worker service
docker compose up --build --scale worker=3
```

Point `SERVER_URL` at the machine running the server when mining from other
devices.

## Mining on a real pool

CPU mining only earns on a real pool with a real wallet.

1. **Get a Monero wallet** (the Wasabi wallet is Bitcoin-only and will not
   work). Good options: [Feather](https://featherwallet.org),
   [Cake Wallet](https://cakewallet.com), or the official Monero GUI/CLI.
   Copy your XMR address (it starts with `4...`).

2. **Pick a pool.** [supportxmr.com](https://supportxmr.com) is a popular,
   no-signup choice (`supportxmr.com:3333`). For zero pool fees, consider
   [P2Pool](https://p2pool.io).

3. **Point the worker at it:**

   ```bash
   cd worker
   POOL_URL=supportxmr.com:3333 \
   WALLET_ADDRESS=4YourMoneroAddressHere... \
   WORKER_NAME=my-rig \
   cargo run --release
   ```

   Or, with Docker, override the `worker` service environment in
   `docker-compose.yml` (`POOL_URL`, `WALLET_ADDRESS`).

## Worker configuration

All flags can also be set as environment variables.

| Flag / env          | Default                  | Description                              |
|---------------------|--------------------------|------------------------------------------|
| `--pool-url` / `POOL_URL`             | `127.0.0.1:3333`         | Pool `host:port`                |
| `--wallet-address` / `WALLET_ADDRESS` | `demo-wallet`            | Monero address / pool login     |
| `--pool-pass` / `POOL_PASS`           | `x`                      | Pool password                   |
| `--worker-name` / `WORKER_NAME`       | `worker-1`               | Name shown on the dashboard     |
| `--threads` / `THREADS`               | `0` (all CPUs)           | Mining thread count             |
| `--server-url` / `SERVER_URL`         | `http://127.0.0.1:4000`  | Monitoring server (empty = off) |

## Server configuration

| Env                    | Default              | Description                          |
|------------------------|----------------------|--------------------------------------|
| `PORT`                 | `4000`               | HTTP + WebSocket port                |
| `DB_PATH`              | `./data/monitor.db`  | SQLite database path                 |
| `HEARTBEAT_TIMEOUT_MS` | `20000`              | Silence before a worker goes offline |
| `HISTORY_RETENTION_MS` | `86400000`           | How long stats history is kept       |

### Server API

- `GET  /health`
- `GET  /api/workers` · `GET /api/workers/:id`
- `GET  /api/workers/:id/history?minutes=60`
- `GET  /api/stats/summary`
- `POST /api/workers/register` · `POST /api/workers/:id/heartbeat`
- `WS   /ws` — pushes a full fleet snapshot on connect and on every change

## Install the dashboard as an app

The dashboard is a PWA. Open it in a browser and use **Install app** (desktop
Chrome/Edge) or **Add to Home Screen** (mobile) to install it on phone or
desktop.

## Tests

```bash
cd worker && cargo test     # RandomX vector, target math, nonce ranges
npm --prefix server test    # store, aggregation, stale detection
```

## How the worker works

1. Connects to the pool and sends a Monero stratum `login`.
2. Receives a job (`blob`, `target`, `seed_hash`) and builds a RandomX cache
   from the seed.
3. Each mining thread writes a nonce into the blob, computes the RandomX
   hash, and checks it against the target.
4. Hashes that meet the target are submitted to the pool as shares.
5. Every 5 seconds it posts a heartbeat (hash rate, shares, uptime) to the
   monitoring server.
