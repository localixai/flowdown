import type { ComponentPropsWithoutRef } from 'react'

/**
 * A table in a box of its own that scrolls sideways: a wide comparison then scrolls inside the
 * reply instead of widening the page, which on a phone pushed every line of text off screen.
 */
export function Table({
  node: _node,
  ...props
}: ComponentPropsWithoutRef<'table'> & { node?: unknown }) {
  return (
    <div className="llx-table">
      <table {...props} />
    </div>
  )
}
