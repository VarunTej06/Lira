export const INPUT = 'bg-lira-bg border border-lira-border rounded px-3 py-2 text-ui text-lira-text min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-lira-blue';

interface FieldProps {
  id: string; label: string; type: string; value: string; autoComplete: string; onChange: (value: string) => void;
  error?: string; hint?: string; placeholder?: string;
}

/** A labelled text field with its message under it. The message is announced to screen readers when it appears. */
export function Field({ id, label, type, value, autoComplete, onChange, error, hint, placeholder }: FieldProps) {
  const note = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ui font-medium text-lira-text">{label}</label>
      <input id={id} type={type} value={value} autoComplete={autoComplete} placeholder={placeholder ?? `Enter your ${id}`} aria-invalid={error ? true : undefined}
        aria-describedby={note} onChange={e => onChange(e.target.value)} className={INPUT} />
      {error ? <p id={`${id}-error`} role="alert" className="text-xs text-lira-blue-text">{error}</p>
        : hint ? <p id={`${id}-hint`} className="text-xs text-lira-muted">{hint}</p> : null}
    </div>
  );
}

/** A message from the server about the whole form, such as a wrong password or no connection. */
export function FormError({ message }: { message: string }) {
  return <p role="alert" className="text-ui bg-lira-blue-light border border-lira-border rounded px-3 py-2.5">{message}</p>;
}
