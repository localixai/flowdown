import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  title: string
  items: Array<{ id: number; label: string; done: boolean }>
  onToggle?: (id: number) => void
}

export function TodoList({ title, items, onToggle }: Props) {
  const [filter, setFilter] = useState<'all' | 'open'>('all')
  const visible = useMemo(
    () => (filter === 'all' ? items : items.filter((item) => !item.done)),
    [filter, items],
  )

  useEffect(() => {
    document.title = `${title} (${visible.length})`
  }, [title, visible.length])

  if (items.length === 0) return <p className="empty">Nothing to do.</p>

  return (
    <section aria-label={title}>
      <h2>{title}</h2>
      <ul>
        {visible.map((item) => (
          <li key={item.id} className={item.done ? 'done' : undefined}>
            <input type="checkbox" checked={item.done} onChange={() => onToggle?.(item.id)} />
            {item.label}
          </li>
        ))}
      </ul>
      <Button variant="ghost" onClick={() => setFilter(filter === 'all' ? 'open' : 'all')}>
        {filter === 'all' ? 'Hide done' : 'Show all'}
      </Button>
    </section>
  )
}
