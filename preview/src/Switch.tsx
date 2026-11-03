import { useState } from 'react'

/**
 * a row of equal boxes under one highlight (kivz.dev's language switch): it glides to the box under the pointer or the
 * focus ring and rests under the chosen one; the words light up with it, not with the cursor
 */
export function Switch<T>({ label, options, value, onChange }: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange(v: T): void
}) {
  const [hot, setHot] = useState<number | null>(null)
  const chosen = options.findIndex(o => Object.is(o.value, value))
  const at = hot ?? chosen
  return (
    <div className="control">
      <span className="label muted">{label}</span>
      <div className="pills-x" role="group" aria-label={label} onPointerLeave={() => setHot(null)}>
        <span className="pill" aria-hidden style={{ width: `${100 / options.length}%`, transform: `translateX(${at * 100}%)` }} />
        {options.map((o, i) => (
          <button
            key={String(o.value)}
            type="button"
            className="btn"
            data-on={i === at ? '' : undefined}
            aria-pressed={i === chosen}
            onPointerEnter={() => setHot(i)}
            onFocus={() => setHot(i)}
            onBlur={() => setHot(null)}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}
