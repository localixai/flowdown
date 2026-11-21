using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;

namespace Acme.Orders.Api;

[ApiController]
[Route("api/[controller]")]
public sealed class OrdersController : ControllerBase
{
    private readonly IOrderStore _store;
    private const int PageSize = 20;

    public OrdersController(IOrderStore store) => _store = store;

    [HttpGet("{id:long}")]
    public async Task<ActionResult<Order>> Get(long id)
    {
        var order = await _store.FindAsync(id);
        if (order is null)
        {
            return NotFound($"order {id} not found");
        }
        return Ok(order);
    }

    [HttpGet]
    public async IAsyncEnumerable<Order> List([FromQuery] int page = 0)
    {
        // Pages are zero-based.
        await foreach (var order in _store.PageAsync(page * PageSize, PageSize))
        {
            yield return order;
        }
    }

    public record Order(long Id, string Customer, decimal Total, DateTime CreatedAt);
}

public interface IOrderStore
{
    Task<OrdersController.Order?> FindAsync(long id);
    IAsyncEnumerable<OrdersController.Order> PageAsync(int skip, int take);
}
