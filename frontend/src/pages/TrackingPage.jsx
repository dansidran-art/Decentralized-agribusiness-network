import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function TrackingPage({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setOrder(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleAction = async (action) => {
    const res = await fetch(`/api/orders/${id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      const updated = await res.json();
      setOrder(updated);
    }
  };

  if (loading) return <p>Loading order...</p>;
  if (!order) return <p>Order not found.</p>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Order #{order.id}</h2>
      <p><strong>Status:</strong> {order.status}</p>
      <p><strong>Total:</strong> ${order.total_amount}</p>

      {/* Buyer actions */}
      {user?.id === order.buyer_id && (
        <div className="mt-4">
          {order.status === "shipped" && (
            <button
              onClick={() => handleAction("confirm_received")}
              className="px-4 py-2 bg-green-600 text-white rounded mr-2"
            >
              ✅ Confirm Received & Release Funds
            </button>
          )}
          {order.status !== "delivered" && (
            <button
              onClick={() => navigate(`/disputes/${order.id}`)}
              className="px-4 py-2 bg-red-600 text-white rounded"
            >
              ⚠️ Open Dispute
            </button>
          )}
        </div>
      )}

      {/* Seller actions */}
      {user?.id === order.seller_id && order.status === "paid" && (
        <div className="mt-4">
          <button
            onClick={() => handleAction("confirm_shipment")}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            📦 Confirm Shipment
          </button>
        </div>
      )}

      {/* Logistics actions */}
      {user?.role === "logistics" && order.status === "shipped" && (
        <div className="mt-4">
          <button
            onClick={() => handleAction("confirm_delivery")}
            className="px-4 py-2 bg-purple-600 text-white rounded"
          >
            🚚 Confirm Delivery
          </button>
        </div>
      )}
    </div>
  );
}