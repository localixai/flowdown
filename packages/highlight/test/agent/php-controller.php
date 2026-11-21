<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class OrderController extends Controller
{
    private const PER_PAGE = 25;

    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status', 'paid');
        $orders = Order::query()
            ->where('status', $status)
            ->orderByDesc('created_at')
            ->paginate(self::PER_PAGE);

        return response()->json($orders);
    }

    public function show(int $id): JsonResponse
    {
        // Return 404 when the order does not exist.
        $order = Order::findOrFail($id);
        $label = "Order #{$order->id} for {$order->customer}";

        return response()->json(['order' => $order, 'label' => $label, 'paid' => true]);
    }
}
