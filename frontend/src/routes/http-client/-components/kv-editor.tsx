import type { KeyValue } from "../api";

export function KeyValueEditor({
  rows,
  onChange,
  testidPrefix,
}: {
  rows: KeyValue[];
  onChange: (next: KeyValue[]) => void;
  testidPrefix: string;
}) {
  const update = (index: number, patch: Partial<KeyValue>) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange(next);
  };
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));
  const add = () => onChange([...rows, { key: "", value: "", enabled: true }]);

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[24px_1fr_1fr_24px] gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-subtle px-1">
        <span></span>
        <span>key</span>
        <span>value</span>
        <span></span>
      </div>
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[24px_1fr_1fr_24px] gap-2 items-center">
          <input
            type="checkbox"
            checked={row.enabled !== false}
            onChange={(e) => update(index, { enabled: e.target.checked })}
            className="accent-accent"
          />
          <input
            value={row.key}
            onChange={(e) => update(index, { key: e.target.value })}
            placeholder="key"
            className="bg-bg border border-border text-fg font-mono text-xs px-2 py-1 rounded-sm focus:border-accent focus:outline-none"
            data-testid={`${testidPrefix}-key-${index}`}
          />
          <input
            value={row.value}
            onChange={(e) => update(index, { value: e.target.value })}
            placeholder="value"
            className="bg-bg border border-border text-fg font-mono text-xs px-2 py-1 rounded-sm focus:border-accent focus:outline-none"
            data-testid={`${testidPrefix}-value-${index}`}
          />
          <button
            type="button"
            onClick={() => remove(index)}
            className="font-mono text-[11px] text-subtle hover:text-error"
            title="remove"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="px-2 py-1 font-mono text-[11px] border border-border hover:border-accent rounded-sm text-subtle hover:text-fg"
        data-testid={`${testidPrefix}-add`}
      >
        + row
      </button>
    </div>
  );
}
