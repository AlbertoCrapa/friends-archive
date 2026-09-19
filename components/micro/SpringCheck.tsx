'use client';

interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  /** Shown after the label, e.g. a live count of what the filter removes. */
  hint?: string;
  disabled?: boolean;
}

/**
 * A checkbox whose press runs as one movement: the box fills, the tick draws
 * behind it and the label is struck through. The strike is not decoration here,
 * it is the meaning: checking one of these strikes those rows from the queue.
 */
export function SpringCheck({ checked, onChange, label, hint, disabled }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="mi mi-check"
      data-on={checked}
    >
      <span className="mi-check-box">
        <span className="mi-check-ring" />
        <span className="mi-check-fill" />
        <svg className="mi-check-tick" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.6 6.2 L4.9 8.5 L9.4 3.6" />
        </svg>
      </span>
      <span className="mi-check-label">{label}</span>
      {hint ? <span style={{ marginLeft: 'auto', opacity: 0.45, fontSize: '0.8em' }}>{hint}</span> : null}
    </button>
  );
}
