package com.acme.orders;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

/**
 * Looks up orders and keeps a small cache of recent ones.
 *
 * @author agent
 */
@Service
public final class OrderService {
    private static final int MAX_CACHED = 256;

    private final OrderRepository repository;
    private final Map<Long, Order> cache = new LinkedHashMap<>(16, 0.75f, true);

    public OrderService(OrderRepository repository) {
        this.repository = repository;
    }

    public Optional<Order> find(long id) {
        Order cached = cache.get(id);
        if (cached != null) {
            return Optional.of(cached);
        }
        return repository.findById(id).map(order -> {
            if (cache.size() >= MAX_CACHED) {
                cache.remove(cache.keySet().iterator().next());
            }
            cache.put(id, order);
            return order;
        });
    }

    @Override
    public String toString() {
        return "OrderService[cached=%d, at=%s]".formatted(cache.size(), Instant.now());
    }

    public CompletableFuture<List<Order>> recent(int limit) {
        String query = """
            SELECT * FROM orders
            ORDER BY created_at DESC
            """;
        return CompletableFuture.supplyAsync(() -> repository.query(query, limit));
    }

    record Order(long id, String customer, double total) {}
}
