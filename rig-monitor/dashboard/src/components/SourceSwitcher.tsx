import { useEffect, useRef, useState } from 'react';
import type { Source, SourceStatus } from '../sources/types';

/**
 * Account-switcher–style miner picker. Shows the active miner as a chip; click
 * it to drop down the full list and switch — which swaps the whole view's data,
 * stat cards, coin unit and accent colour. A gear on each row opens that
 * miner's settings.
 */
export function SourceSwitcher({
  sources,
  activeId,
  activeStatus,
  isConfigured,
  onSelect,
  onManage,
}: {
  sources: Source[];
  activeId: string;
  activeStatus: SourceStatus;
  isConfigured: (id: string) => boolean;
  onSelect: (id: string) => void;
  onManage: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = sources.find((s) => s.id === activeId) ?? sources[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="switcher" ref={ref}>
      <button
        className="switcher-chip"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="avatar" style={{ background: active.accent }}>
          {active.emoji}
        </span>
        <span className="switcher-chip-text">
          <span className="switcher-chip-label">{active.label}</span>
          <span className="switcher-chip-sub">{statusLabel(activeStatus)}</span>
        </span>
        <span className="caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="switcher-menu" role="menu">
          <div className="switcher-menu-head">Switch miner</div>
          {sources.map((source) => {
            const isActive = source.id === activeId;
            const configured = isConfigured(source.id);
            return (
              <div
                key={source.id}
                className={`switcher-item${isActive ? ' is-active' : ''}`}
              >
                <button
                  className="switcher-item-main"
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    onSelect(source.id);
                    setOpen(false);
                  }}
                >
                  <span className="avatar" style={{ background: source.accent }}>
                    {source.emoji}
                  </span>
                  <span className="switcher-item-text">
                    <span className="switcher-item-label">
                      {source.label}
                      {isActive && <span className="pill">active</span>}
                      {!configured && <span className="pill pill-warn">setup</span>}
                    </span>
                    <span className="switcher-item-tag">{source.tagline}</span>
                  </span>
                </button>
                <button
                  className="switcher-item-gear"
                  type="button"
                  title={`${source.label} settings`}
                  aria-label={`${source.label} settings`}
                  onClick={() => {
                    onManage(source.id);
                    setOpen(false);
                  }}
                >
                  ⚙
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function statusLabel(status: SourceStatus): string {
  switch (status) {
    case 'live':
      return 'live';
    case 'loading':
      return 'connecting…';
    case 'unconfigured':
      return 'needs setup';
    case 'error':
      return 'connection error';
  }
}
