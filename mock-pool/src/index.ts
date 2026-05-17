import net from 'node:net';
import { randomBytes, randomUUID } from 'node:crypto';

/**
 * A minimal mock Monero stratum pool. It speaks just enough of the protocol
 * (`login`, `job`, `submit`, `keepalived`) for the worker to mine end-to-end
 * with no real pool or wallet. It does NOT verify shares — every submission is
 * accepted — so it is strictly a local demo / test aid, never a real pool.
 */

const PORT = Number(process.env.MOCK_POOL_PORT ?? 3333);
/** Pool difficulty: lower => workers find shares sooner. */
const DIFFICULTY = Number(process.env.MOCK_POOL_DIFFICULTY ?? 1000);
/** How often a fresh job is pushed to connected workers. */
const JOB_INTERVAL_MS = Number(process.env.MOCK_POOL_JOB_INTERVAL_MS ?? 30_000);

/** Fixed RandomX seed hash so workers build their cache only once. */
const SEED_HASH = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

interface Job {
  job_id: string;
  blob: string;
  target: string;
  seed_hash: string;
  height: number;
}

interface Client {
  socket: net.Socket;
  sessionId: string;
}

const clients = new Set<Client>();
let jobCounter = 0;

/** Encode a difficulty as a 4-byte little-endian Monero stratum target. */
function targetHex(difficulty: number): string {
  const value = Math.max(1, Math.floor(0xffffffff / Math.max(1, difficulty))) >>> 0;
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value);
  return buf.toString('hex');
}

function makeJob(): Job {
  jobCounter += 1;
  return {
    job_id: `job-${jobCounter}`,
    // 76-byte synthetic hashing blob; the worker overwrites the nonce field.
    blob: randomBytes(76).toString('hex'),
    target: targetHex(DIFFICULTY),
    seed_hash: SEED_HASH,
    height: 3_000_000 + jobCounter,
  };
}

function log(message: string): void {
  console.log(`[mock-pool ${new Date().toISOString()}] ${message}`);
}

function writeJson(socket: net.Socket, payload: unknown): void {
  try {
    socket.write(`${JSON.stringify(payload)}\n`);
  } catch {
    // socket already closed; ignore.
  }
}

const server = net.createServer((socket) => {
  const client: Client = { socket, sessionId: randomUUID() };
  clients.add(client);
  let accepted = 0;
  let buffer = '';
  socket.setEncoding('utf8');

  const handle = (line: string): void => {
    let msg: { id?: unknown; method?: string; params?: { login?: string } };
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    const id = (msg.id as number | string | null) ?? null;

    switch (msg.method) {
      case 'login':
        log(`worker logged in: ${msg.params?.login ?? 'unknown'}`);
        writeJson(socket, {
          id,
          jsonrpc: '2.0',
          error: null,
          result: { id: client.sessionId, job: makeJob(), status: 'OK' },
        });
        break;
      case 'submit':
        accepted += 1;
        log(`share accepted (this connection: ${accepted})`);
        writeJson(socket, { id, jsonrpc: '2.0', error: null, result: { status: 'OK' } });
        break;
      case 'keepalived':
        writeJson(socket, {
          id,
          jsonrpc: '2.0',
          error: null,
          result: { status: 'KEEPALIVED' },
        });
        break;
      default:
        writeJson(socket, { id, jsonrpc: '2.0', error: null, result: { status: 'OK' } });
    }
  };

  socket.on('data', (chunk: string) => {
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) {
        handle(line);
      }
      newline = buffer.indexOf('\n');
    }
  });

  socket.on('error', () => {
    /* connection reset by worker; cleaned up on close. */
  });
  socket.on('close', () => {
    clients.delete(client);
  });
});

// Push a fresh job to every connected worker on a fixed cadence.
setInterval(() => {
  if (clients.size === 0) {
    return;
  }
  const job = makeJob();
  for (const client of clients) {
    writeJson(client.socket, { jsonrpc: '2.0', method: 'job', params: job });
  }
}, JOB_INTERVAL_MS);

server.listen(PORT, () => {
  log(`listening on 0.0.0.0:${PORT} (difficulty ${DIFFICULTY})`);
});
