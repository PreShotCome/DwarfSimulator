import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { buildSnapshot, readCreds } from './nicehash';
import { buildLolminerSnapshot, LOLMINER_API_URL } from './lolminer';
import { buildExcavatorSnapshot } from './excavator';

const app = express();
app.use(cors());

const PORT = Number(process.env.PORT ?? 4100);

app.get('/health', (_req, res) => {
  res.json({ ok: true, nicehashConfigured: readCreds() !== null });
});

/**
 * Normalized NiceHash snapshot for the dashboard. Returns 501 (not 4xx/5xx) when
 * keys are missing so the dashboard can show a friendly "needs setup" state
 * instead of an error.
 */
app.get('/api/nicehash/snapshot', async (_req, res) => {
  const creds = readCreds();
  if (!creds) {
    res.status(501).json({
      message:
        'NiceHash API keys are not set. Add NICEHASH_API_KEY / NICEHASH_API_SECRET / NICEHASH_ORG_ID to the server environment.',
    });
    return;
  }
  try {
    const snapshot = await buildSnapshot(creds);
    res.json(snapshot);
  } catch (error) {
    res.status(502).json({
      message: error instanceof Error ? error.message : 'NiceHash request failed.',
    });
  }
});

/**
 * Live local stats from lolMiner's HTTP API. Returns 501 (not an error) when
 * lolMiner isn't reachable, so the dashboard can show a friendly "start
 * lolMiner with --apiport" hint instead of an error.
 */
app.get('/api/lolminer/snapshot', async (_req, res) => {
  try {
    const snapshot = await buildLolminerSnapshot();
    res.json(snapshot);
  } catch {
    res.status(501).json({
      message: `Could not reach lolMiner's API at ${LOLMINER_API_URL}. Start lolMiner with --apiport 4444.`,
    });
  }
});

/**
 * Unified live-rig snapshot: auto-detects whichever miner is running — lolMiner
 * (Ergo) first, then NiceHash's Excavator. 501 if neither is reachable.
 */
app.get('/api/rig/snapshot', async (_req, res) => {
  try {
    res.json(await buildLolminerSnapshot());
    return;
  } catch {
    /* lolMiner not running — try Excavator (NiceHash). */
  }
  try {
    res.json(await buildExcavatorSnapshot());
    return;
  } catch {
    /* Excavator not running either. */
  }
  res.status(501).json({
    message:
      'No local miner detected. Start lolMiner (Ergo, --apiport 4444) or NiceHash QuickMiner (Excavator).',
  });
});

app.listen(PORT, () => {
  const configured = readCreds() !== null;
  // eslint-disable-next-line no-console
  console.log(
    `rig-monitor NiceHash proxy on http://localhost:${PORT} ` +
      `(NiceHash keys ${configured ? 'loaded' : 'NOT set — see .env.example'})`,
  );
});
