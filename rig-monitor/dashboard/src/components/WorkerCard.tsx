import type { Worker } from '../sources/types';
import { formatAgo, formatHashrate, formatNumber } from '../format';

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
        <Row label="Accepted" value={formatNumber(worker.accepted)} />
        <Row label="Rejected" value={formatNumber(worker.rejected)} />
        <Row label="Last share" value={formatAgo(worker.lastSeen)} />
        {worker.extra?.map((e) => (
          <Row key={e.label} label={e.label} value={e.value} />
        ))}
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
