import React, { useState, useEffect } from "react";
import DisputeChat from "../components/DisputeChat";

export default function OrderTracking({ user }) {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [openDispute, setOpenDispute] = useState(null);

  // Fetch orders for this user
  useEffect(() => {
    fetch("/api/orders")
      .then(res => res.json())
      .then(data => setOrders(data.orders || []));
  }, []);

  // Handle order actions
  const handleAction = async (orderId, action) => {
    const res = await fetch(`/api/orders/${orderId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    alert(data.message || "Action completed");
    // Refresh orders
    const updated = await fetch("/api/orders").then(r => r.json());
    setOrders(updated.orders || []);
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Order Tracking</h1>

      {orders.length === 0 && <p>No orders yet.</p>}

      <ul className="space-y-4">
        {orders.map(order => (
          <li key={order.id} className="border p-4 rounded bg-white">
            <p>
              <strong>Order #{order.id}</strong> — {order.status}
            </p>
            <p>
              Product: {order.product_name} <br />
              Quantity: {order.quantity} <br />
              Total: ${order.total_amount}
            </p>

            {/* Buyer Actions */}
            {user?.id === order.buyer_id && (
              <div className="mt-2 flex gap-2">
                {order.status === "delivered" && (
                  <button
                    onClick={() => handleAction(order.id, "confirm_delivery")}
                    className="bg-green-600 text-white px-3 py-1 rounded"
                  >
                    Confirm & Release Funds
                  </button>
                )}
                <button
                  onClick={() => setOpenDispute(order.id)}
                  className="bg-red-600 text-white px-3 py-1 rounded"
                >
                  Open Dispute
                </button>
              </div>
            )}

            {/* Seller Actions */}
            {user?.id === order.seller_id && order.status === "paid" && (
              <button
                onClick={() => handleAction(order.id, "ship")}
                className="bg-blue-600 text-white px-3 py-1 rounded mt-2"
              >
                Confirm Shipment
              </button>
            )}

            {/* Logistics Actions */}
            {user?.role === "logistics" && order.status === "shipped" && (
              <button
                onClick={() => handleAction(order.id, "deliver")}
                className="bg-purple-600 text-white px-3 py-1 rounded mt-2"
              >
                Confirm Delivery
              </button>
            )}

            {/* Dispute Chat */}
            {openDispute === order.id && (
              <div className="mt-4">
                <DisputeChat orderId={order.id} user={user} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}