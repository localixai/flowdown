-- 0007: orders and their items
BEGIN;

CREATE TABLE IF NOT EXISTS orders (
  id          BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'shipped')),
  total_cents INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX orders_customer_created_idx ON orders (customer_id, created_at DESC);

/* Backfill totals from the items already there. */
UPDATE orders o
SET total_cents = sub.total
FROM (
  SELECT order_id, SUM(quantity * price_cents) AS total
  FROM order_items
  GROUP BY order_id
) AS sub
WHERE sub.order_id = o.id;

SELECT c.name, COUNT(*) AS orders, ROUND(AVG(o.total_cents) / 100.0, 2) AS average
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE o.created_at >= NOW() - INTERVAL '30 days' AND o.status <> 'pending'
GROUP BY c.name
HAVING COUNT(*) > 3
ORDER BY average DESC
LIMIT 20;

INSERT INTO audit_log (action, payload) VALUES ('migrate', '{"version": 7}'), ($1, $2);

COMMIT;
