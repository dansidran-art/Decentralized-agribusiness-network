import React, { useState, useEffect } from "react";

export default function OrderTracking({ user }) {
  const [orders, setOrders] = useState([]);
  const [chat, setChat] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [upload, setUpload] = useState(null);

  // Fetch user orders (buyer or seller)
  useEffect(() => {
    if (!user) return;
    fetch(`/api/orders?userId=${user.id}`)
      .then(res => res.json())
      .then(setOrders)
      .catch(err => console.error("Failed to fetch orders:", err));
  }, [user]);

  const handleAction = async (orderId, action) => {
    const res = await fetch(`/api/orders/${orderId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userId: user.id }),
    });
    const data = await res.json();
    alert(data.message || "Action completed");
    setOrders(orders.map(o => (o.id === orderId ? { ...o, status: data.status } : o)));
  };

  const sendMessage = async () => {
    if (!message && !upload) return;

    const formData = new FormData();
    formData.append("userId", user.id);
    formData.append("message", message);
    if (upload) formData.append("file", upload);

    const res = await fetch(`/api/chat/${selectedOrder.id}`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setChat([...chat, data]);
    setMessage("");
    setUpload(null);
  };

  const loadChat = async (order) => {
    setSelectedOrder(order);
    const res = await fetch(`/api/chat/${order.id}`);
    const data = await res.json();
    setChat(data);
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4">📦 Order Tracking</h2>

      {orders.length === 0 ? (
        <p>No active orders found.</p>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="border p-4 rounded-md shadow-sm">
              <p><strong>Order #{order.id}</strong> — {order.status}</p>
              <p>Product ID: {order.product_id}</p>
              <p>Quantity: {order.quantity}</p>
              <p>Total: ${order.total_amount}</p>

              <div className="mt-2 space-x-2">
                {user.role === "buyer" && order.status === "delivered" && (
                  <>
                    <button
                      onClick={() => handleAction(order.id, "release")}
                      className="bg-green-600 text-white px-3 py-1 rounded"
                    >
                      ✅ Confirm & Release
                    </button>
                    <button
                      onClick={() => handleAction(order.id, "dispute")}
                      className="bg-red-600 text-white px-3 py-1 rounded"
                    >
                      ⚠️ Open Dispute
                    </button>
                  </>
                )}

                {user.role === "seller" && order.status === "paid" && (
                  <button
                    onClick={() => handleAction(order.id, "ship")}
                    className="bg-blue-600 text-white px-3 py-1 rounded"
                  >
                    🚚 Confirm Shipment
                  </button>
                )}

                {user.role === "logistics" && order.status === "shipped" && (
                  <button
                    onClick={() => handleAction(order.id, "deliver")}
                    className="bg-green-500 text-white px-3 py-1 rounded"
                  >
                    📦 Confirm Delivery
                  </button>
                )}

                <button
                  onClick={() => loadChat(order)}
                  className="bg-gray-500 text-white px-3 py-1 rounded"
                >
                  💬 View Chat
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedOrder && (
        <div className="mt-8 border-t pt-4">
          <h3 className="text-xl font-bold">Chat for Order #{selectedOrder.id}</h3>
          <div className="bg-gray-50 p-3 rounded h-64 overflow-y-auto mb-3 border">
            {chat.map((msg, i) => (
              <div
                key={i}
                className={`mb-2 ${msg.sender === "ai" ? "text-blue-600" : "text-gray-800"}`}
              >
                <strong>{msg.sender === "ai" ? "Gemini AI:" : msg.user_name}</strong>:{" "}
                {msg.message}
                {msg.image && (
                  <img
                    src={msg.image}
                    alt="evidence"
                    className="w-32 h-32 object-cover mt-2 rounded"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="file"
              onChange={(e) => setUpload(e.target.files[0])}
              className="border p-2 rounded w-1/3"
            />
            <input
              type="text"
              placeholder="Type message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="border flex-1 p-2 rounded"
            />
            <button
              onClick={sendMessage}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}