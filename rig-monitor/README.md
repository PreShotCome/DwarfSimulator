# Rig Monitor

A multi-miner monitoring dashboard with an **account-switcher–style source
picker**. Pick a miner from the chip in the top-right and the whole view swaps —
its data, headline stats, coin unit, and accent colour — just like switching
Google accounts.

- **NiceHash** (default) — stack BTC. Server-proxied (keys stay off the browser).
  *Scaffolded:* wire your API keys into the proxy to go live.
- **Ergo** — mine ERG to your own wallet. **Live now**, no API key: just paste
  your `9…` payout address. Reads the public herominers pool API.

Adding another miner later is one file: write an adapter in
`dashboard/src/sources/` and append it to `registry.ts`. Nothing else changes —
the visual components render any source's normalized snapshot.

## Layout

```
rig-monitor/
  dashboard/   Vite + React + TS — the UI and the source adapters
    src/sources/   one file per miner (nicehash.ts, ergo.ts) + registry
    src/hooks/     useSource (polling + client-side history), useConfig
    src/components/ SourceSwitcher, SummaryBar, WorkerCard, WorkerDetail, ...
  server/      Node + TS — NiceHash proxy (HMAC-signs requests server-side)
```

## Run the dashboard (Ergo works immediately)

```bash
cd rig-monitor/dashboard
npm install
npm run dev          # http://localhost:5174
```

1. Open the source switcher (top-right) → **Ergo** → ⚙ settings.
2. Paste your Ergo payout address (`9…`) and save.
3. Live pool hashrate, balance, and per-worker stats appear within ~15s.

> Pool stats keyed on a payout address are public, so no key is needed. If your
> environment blocks the cross-origin call to the pool, set the optional
> "API base" field to a proxy that forwards to `ergo.herominers.com`.

## Enable NiceHash (BTC) — needs the proxy

NiceHash requires HMAC-signed requests with an API **secret**, which must never
live in a browser. The included proxy holds the keys and serves a normalized
snapshot the dashboard reads.

```bash
cd rig-monitor/server
npm install
cp .env.example .env       # then fill in your three NiceHash values
npm run dev                # http://localhost:4100
```

Create the key at **NiceHash → Settings → API Keys** (view-only permissions are
enough). Then in the dashboard: switcher → **NiceHash** → ⚙ → set Proxy URL to
`http://localhost:4100` → save.

Until keys are set, NiceHash shows a friendly "needs setup" state — the rest of
the dashboard (and Ergo) works regardless.

## Notes

- Updates poll every 15s; the hashrate trend chart is built client-side from
  those samples (pool/proxy APIs return snapshots, not time series).
- Your settings (active miner, wallet address, proxy URL) persist in
  `localStorage`. Secrets (NiceHash API key/secret) live only in the server's
  environment, never in the browser.
- The NiceHash adapter's hash-rate units are reported as NiceHash gives them
  ("NH units"); per-algorithm normalization can be added once you're mining and
  can see the live shape.
