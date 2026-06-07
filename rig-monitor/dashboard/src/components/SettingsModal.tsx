import { useEffect, useState } from 'react';
import type { Source, SourceConfig } from '../sources/types';

/** Per-source settings form (wallet address, proxy URL, ...). */
export function SettingsModal({
  source,
  initial,
  onSave,
  onClose,
}: {
  source: Source;
  initial: SourceConfig;
  onSave: (config: SourceConfig) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<SourceConfig>(() => ({ ...initial }));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
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
        aria-label={`${source.label} settings`}
      >
        <div className="modal-head">
          <h2>
            <span className="avatar" style={{ background: source.accent }}>
              {source.emoji}
            </span>
            {source.label} settings
          </h2>
          <button className="close" onClick={onClose} type="button" aria-label="Close">
            ×
          </button>
        </div>

        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(values);
          }}
        >
          {source.configFields.map((field) => (
            <label className="field" key={field.key}>
              <span className="field-label">{field.label}</span>
              <input
                className="field-input"
                type={field.secret ? 'password' : 'text'}
                value={values[field.key] ?? ''}
                placeholder={field.placeholder}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
              />
              {field.help && <span className="field-help">{field.help}</span>}
            </label>
          ))}

          <div className="settings-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-accent">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
