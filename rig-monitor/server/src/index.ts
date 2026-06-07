import express from 'express';
import cors from 'cors';
import { buildSnapshot, readCreds } from './nicehash';

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

app.listen(PORT, () => {
  const configured = readCreds() !== null;
  // eslint-disable-next-line no-console
  console.log(
    `rig-monitor NiceHash proxy on http://localhost:${PORT} ` +
      `(NiceHash keys ${configured ? 'loaded' : 'NOT set — see .env.example'})`,
  );
});
