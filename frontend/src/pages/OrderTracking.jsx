import React, { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8787";

export default function OrdersPage({ user }) {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [chatMessage, setChatMessage] = useState("");
  const [chatImage, setChatImage] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    fetch(`${API}/api/orders?user_id=${user.id}`)
      .then((res) => res.json())
      .then(setOrders)
      .catch(() => {});
  }, [user]);

  const updateStatus = async (id, action) => {
    const res = await fetch(`${API}/api/orders/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id, action }),
    });
    const data = await res.json();
    if (data.success) {
      alert(`Order ${action} success`);
      setOrders((o) => o.map((ord) => (ord.id === id ? { ...ord, status: data.status } : ord)));
    }
  };

  const sendMessage = async () => {
    if (!chatMessage && !chatImage) return;
    const formData = new FormData();
    formData.append("user_id", user.id);
    formData.append("order_id", selectedOrder.id);
    formData.append("message", chatMessage);
    if (chatImage) formData.append("image", chatImage);

    const res = await fetch(`${API}/api/orders/chat`, { method: "POST", body: formData });
    const data = await res.json();
    if (data.success) {
      setMessages([...messages, { message: chatMessage, image: chatImage ? URL.createObjectURL(chatImage) : null }]);
      setChatMessage("");
      setChatImage(null);
    }
  };

  const loadChat = async (order) => {
    setSelectedOrder(order);
    const res = await fetch(`${API}/api/orders/chat?order_id=${order.id}`);
    const data = await res.json();
    setMessages(data.messages || []);
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">📦 My Orders</h2>
      {orders.map((o) => (
        <div key={o.id} className="bg-white shadow rounded-lg p-4 mb-3">
          <p><strong>Product:</strong> {o.product_name}</p>
          <p><strong>Status:</strong> {o.status}</p>
          <div className="flex space-x-2 mt-2">
            {user.id === o.buyer_id && o.status === "delivered" && (
              <>
                <button
                  onClick={() => updateStatus(o.id, "release")}
                  className="bg-green-700 text-white px-2 py-1 rounded"
                >
                  Confirm & Release Funds
                </button>
                <button
                  onClick={() => updateStatus(o.id, "dispute")}
                  className="bg-red-600 text-white px-2 py-1 rounded"
                >
                  Open Dispute
                </button>
              </>
            )}
            {user.id === o.seller_id && o.status === "paid" && (
              <button
                onClick={() => updateStatus(o.id, "shipped")}
                className="bg-blue-600 text-white px-2 py-1 rounded"
              >
                Confirm Shipment
              </button>
            )}
            <button
              onClick={() => loadChat(o)}
              className="bg-gray-600 text-white px-2 py-1 rounded"
            >
              Open Chat
            </button>
          </div>
        </div>
      ))}

      {selectedOrder && (
        <div className="mt-6 bg-white p-4 rounded shadow-md">
          <h3 className="font-semibold">Dispute / Support Chat</h3>
          <div className="max-h-64 overflow-y-auto border p-2 mb-3">
            {messages.map((m, i) => (
              <div key={i} className="mb-2">
                <p>{m.message}</p>
                {m.image && <img src={m.image} alt="chat" className="w-32 mt-1 rounded" />}
              </div>
            ))}
          </div>
          <textarea
            placeholder="Type your message..."
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            className="w-full border p-2 rounded mb-2"
          />
          <input type="file" accept="image/*" onChange={(e) => setChatImage(e.target.files[0])} />
          <button
            onClick={sendMessage}
            className="bg-green-700 text-white px-4 py-2 mt-2 rounded block"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}