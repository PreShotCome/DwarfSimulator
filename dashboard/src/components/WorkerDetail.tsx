import { useEffect } from 'react';
import type { Worker } from '../api';
import { formatHashrate, formatNumber, formatUptime } from '../format';
import { HashChart } from './HashChart';

export function WorkerDetail({
  worker,
  onClose,
}: {
  worker: Worker;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Worker ${worker.name}`}
      >
        <div className="modal-head">
          <h2>
            <span className={`dot dot-${worker.status}`} aria-hidden="true" />
            {worker.name}
          </h2>
          <button className="close" onClick={onClose} type="button" aria-label="Close">
            ×
          </button>
        </div>

        <div className="detail-stats">
          <Tile label="Hashrate" value={formatHashrate(worker.hashrate)} accent />
          <Tile label="Status" value={worker.status} />
          <Tile label="Threads" value={String(worker.threads)} />
          <Tile label="Uptime" value={formatUptime(worker.uptimeSeconds)} />
          <Tile label="Accepted" value={formatNumber(worker.accepted)} />
          <Tile label="Rejected" value={formatNumber(worker.rejected)} />
        </div>

        <h3>Hashrate (last hour)</h3>
        <HashChart workerId={worker.id} />

        <dl className="detail-meta">
          <div className="row">
            <dt>Host</dt>
            <dd>{worker.host}</dd>
          </div>
          <div className="row">
            <dt>Pool</dt>
            <dd>{worker.pool}</dd>
          </div>
          <div className="row">
            <dt>Last seen</dt>
            <dd>{new Date(worker.lastSeen).toLocaleString()}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="tile">
      <div className={`tile-value${accent ? ' accent' : ''}`}>{value}</div>
      <div className="tile-label">{label}</div>
    </div>
  );
}
