import type { Worker } from '../api';
import { formatHashrate, formatNumber, formatUptime } from '../format';

export function WorkerCard({
  worker,
  onSelect,
}: {
  worker: Worker;
  onSelect: () => void;
}) {
  return (
    <button className="card" onClick={onSelect} type="button">
      <div className="card-head">
        <span className={`dot dot-${worker.status}`} aria-hidden="true" />
        <span className="card-name">{worker.name}</span>
      </div>
      <div className="card-hashrate">{formatHashrate(worker.hashrate)}</div>
      <dl className="card-rows">
        <Row label="Status" value={worker.status} />
        <Row label="Host" value={worker.host} />
        <Row label="Threads" value={String(worker.threads)} />
        <Row label="Accepted" value={formatNumber(worker.accepted)} />
        <Row label="Rejected" value={formatNumber(worker.rejected)} />
        <Row label="Uptime" value={formatUptime(worker.uptimeSeconds)} />
      </dl>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
