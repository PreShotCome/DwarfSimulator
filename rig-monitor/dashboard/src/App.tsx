import { useMemo, useState } from 'react';
import { SOURCES, getSource } from './sources/registry';
import { useConfig } from './hooks/useConfig';
import { useSource } from './hooks/useSource';
import { SourceSwitcher } from './components/SourceSwitcher';
import { SummaryBar } from './components/SummaryBar';
import { WorkerCard } from './components/WorkerCard';
import { WorkerDetail } from './components/WorkerDetail';
import { RateChart } from './components/RateChart';
import { SettingsModal } from './components/SettingsModal';
import type { SourceStatus } from './sources/types';

export function App() {
  const { activeId, setActiveId, configFor, setConfig } = useConfig();
  const active = getSource(activeId);
  const { snapshot, history, loaded } = useSource(activeId, configFor(activeId));

  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [managingId, setManagingId] = useState<string | null>(null);

  const status: SourceStatus = snapshot?.status ?? (loaded ? 'error' : 'loading');
  const workers = snapshot?.workers ?? [];
  const selectedWorker =
    workers.find((w) => w.id === selectedWorkerId) ?? null;
  const managingSource = managingId ? getSource(managingId) : null;

  // A source counts as "configured" once its primary field has a value.
  const isConfigured = useMemo(
    () => (id: string) => {
      const source = getSource(id);
      const primary = source.configFields[0]?.key;
      if (!primary) return true;
      return Boolean((configFor(id)[primary] ?? '').trim());
    },
    [configFor],
  );

  return (
    <div className="app" style={{ ['--accent' as string]: active.accent }}>
      <header className="app-header">
        <h1>
          <span className="logo" aria-hidden="true">
            ⛏️
          </span>
          Rig Monitor
        </h1>
        <SourceSwitcher
          sources={SOURCES}
          activeId={activeId}
          activeStatus={status}
          isConfigured={isConfigured}
          onSelect={(id) => {
            setActiveId(id);
            setSelectedWorkerId(null);
          }}
          onManage={(id) => setManagingId(id)}
        />
      </header>

      {status !== 'live' && (
        <StateBanner
          status={status}
          message={snapshot?.message}
          onManage={() => setManagingId(activeId)}
        />
      )}

      <SummaryBar stats={snapshot?.stats ?? []} />

      {status === 'live' && (
        <>
          <h3>{active.label} hashrate (last hour)</h3>
          <RateChart samples={history} accent={active.accent} />

          {workers.length === 0 ? (
            <p className="empty">
              No workers reporting yet. Once your miner connects and submits
              shares, it will appear here.
            </p>
          ) : (
            <div className="grid">
              {workers.map((worker) => (
                <WorkerCard
                  key={worker.id}
                  worker={worker}
                  onSelect={() => setSelectedWorkerId(worker.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {selectedWorker && (
        <WorkerDetail
          worker={selectedWorker}
          onClose={() => setSelectedWorkerId(null)}
        />
      )}

      {managingSource && (
        <SettingsModal
          source={managingSource}
          initial={configFor(managingSource.id)}
          onSave={(config) => {
            setConfig(managingSource.id, config);
            setManagingId(null);
          }}
          onClose={() => setManagingId(null)}
        />
      )}

      <footer className="app-footer">
        Monitoring {active.label} · {workers.length} worker
        {workers.length === 1 ? '' : 's'} · updates every 15s
      </footer>
    </div>
  );
}

function StateBanner({
  status,
  message,
  onManage,
}: {
  status: SourceStatus;
  message?: string;
  onManage: () => void;
}) {
  if (status === 'loading') {
    return <div className="banner">Connecting…</div>;
  }
  const fallback =
    status === 'unconfigured'
      ? 'This miner needs to be set up before it can show data.'
      : 'Something went wrong fetching this miner.';
  return (
    <div className={`banner banner-${status}`}>
      <span>{message ?? fallback}</span>
      <button className="btn btn-accent" type="button" onClick={onManage}>
        {status === 'unconfigured' ? 'Set up' : 'Settings'}
      </button>
    </div>
  );
}
