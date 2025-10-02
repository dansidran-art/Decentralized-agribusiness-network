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
import React, { useEffect, useState } from "react";

export default function OrderTracking({ user }) {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [image, setImage] = useState(null);

  // Load all user orders
  useEffect(() => {
    fetch("/api/orders")
      .then((res) => res.json())
      .then(setOrders)
      .catch(console.error);
  }, []);

  // Load messages when an order is selected
  useEffect(() => {
    if (selectedOrder) {
      fetch(`/api/orders/${selectedOrder.id}/dispute`)
        .then((res) => res.json())
        .then(setMessages)
        .catch(console.error);
    }
  }, [selectedOrder]);

  // Send message (with optional image)
  const sendMessage = async () => {
    if (!selectedOrder) return;

    const formData = new FormData();
    formData.append("message", newMessage);
    if (image) formData.append("image", image);

    await fetch(`/api/orders/${selectedOrder.id}/dispute`, {
      method: "POST",
      body: formData,
    });

    setNewMessage("");
    setImage(null);

    // reload chat
    fetch(`/api/orders/${selectedOrder.id}/dispute`)
      .then((res) => res.json())
      .then(setMessages);
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">📦 Order Tracking</h2>

      {/* Orders list */}
      <div className="flex gap-6">
        <div className="w-1/3 border rounded p-3">
          <h3 className="font-semibold">My Orders</h3>
          <ul>
            {orders.map((order) => (
              <li
                key={order.id}
                className={`p-2 cursor-pointer rounded ${
                  selectedOrder?.id === order.id ? "bg-blue-100" : ""
                }`}
                onClick={() => setSelectedOrder(order)}
              >
                Order #{order.id} - {order.status}
              </li>
            ))}
          </ul>
        </div>

        {/* Chat + actions */}
        {selectedOrder && (
          <div className="w-2/3 border rounded p-3 flex flex-col">
            <h3 className="font-semibold mb-2">
              Order #{selectedOrder.id} – Status:{" "}
              <span className="text-blue-600">{selectedOrder.status}</span>
            </h3>

            <div className="flex-1 overflow-y-auto border p-2 mb-3 bg-gray-50 rounded">
              {messages.map((msg) => (
                <div key={msg.id} className="mb-2">
                  <span className="font-bold">{msg.user_id}:</span>{" "}
                  {msg.message}
                  {msg.image_url && (
                    <div>
                      <img
                        src={msg.image_url}
                        alt="evidence"
                        className="mt-1 max-h-40 rounded"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 border p-2 rounded"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <input
                type="file"
                onChange={(e) => setImage(e.target.files[0])}
              />
              <button
                onClick={sendMessage}
                className="bg-blue-600 text-white px-4 rounded"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
// frontend/src/pages/OrderTracking.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

function OrderTracking({ user }) {
  const [orders, setOrders] = useState([]);
  const [chatMessages, setChatMessages] = useState({});
  const [newMessage, setNewMessage] = useState({});
  const [newImage, setNewImage] = useState({});

  useEffect(() => {
    if (user) {
      axios.get("/api/orders", { headers: { Authorization: `Bearer ${user.token}` } })
        .then(res => setOrders(res.data))
        .catch(err => console.error(err));
    }
  }, [user]);

  const handleSendMessage = async (orderId) => {
    if (!newMessage[orderId] && !newImage[orderId]) return;

    const formData = new FormData();
    if (newMessage[orderId]) formData.append("message", newMessage[orderId]);
    if (newImage[orderId]) formData.append("image", newImage[orderId]);

    await axios.post(`/api/orders/${orderId}/chat`, formData, {
      headers: {
        Authorization: `Bearer ${user.token}`,
        "Content-Type": "multipart/form-data",
      },
    });

    setNewMessage({ ...newMessage, [orderId]: "" });
    setNewImage({ ...newImage, [orderId]: null });

    // refresh chats
    fetchChat(orderId);
  };

  const fetchChat = async (orderId) => {
    const res = await axios.get(`/api/orders/${orderId}/chat`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    setChatMessages({ ...chatMessages, [orderId]: res.data });
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Order Tracking</h2>
      {orders.map((order) => (
        <div key={order.id} className="border p-4 mb-6 rounded shadow">
          <h3 className="font-semibold">
            Order #{order.id} — {order.status}
          </h3>
          <p>Product: {order.product_name}</p>
          <p>Quantity: {order.quantity}</p>
          <p>Total: ${order.total_amount}</p>

          {/* Action Buttons */}
          <div className="mt-3 flex space-x-3">
            {user.role === "buyer" && order.status === "delivered" && (
              <>
                <button className="bg-green-600 text-white px-3 py-1 rounded">
                  Confirm & Release Funds
                </button>
                <button className="bg-yellow-500 text-white px-3 py-1 rounded">
                  Open Dispute
                </button>
              </>
            )}
            {user.role === "seller" && order.status === "paid" && (
              <button className="bg-blue-600 text-white px-3 py-1 rounded">
                Confirm Shipment
              </button>
            )}
            {user.role === "logistics" && order.status === "shipped" && (
              <button className="bg-purple-600 text-white px-3 py-1 rounded">
                Confirm Delivery
              </button>
            )}
          </div>

          {/* Chat Section */}
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Order Chat</h4>
            <div className="border p-2 h-40 overflow-y-scroll bg-gray-50">
              {(chatMessages[order.id] || []).map((msg, i) => (
                <div key={i} className="mb-2">
                  <strong>{msg.sender}:</strong> {msg.message}
                  {msg.image_url && (
                    <div>
                      <img
                        src={msg.image_url}
                        alt="chat upload"
                        className="max-h-32 mt-2 rounded"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex mt-2 space-x-2">
              <input
                type="text"
                placeholder="Type message..."
                value={newMessage[order.id] || ""}
                onChange={(e) =>
                  setNewMessage({ ...newMessage, [order.id]: e.target.value })
                }
                className="flex-1 border px-2 py-1 rounded"
              />
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  setNewImage({ ...newImage, [order.id]: e.target.files[0] })
                }
                className="border px-2 py-1 rounded"
              />
              <button
                onClick={() => handleSendMessage(order.id)}
                className="bg-green-600 text-white px-3 py-1 rounded"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default OrderTracking;
import React, { useState, useEffect } from "react";
import OrderChat from "./OrderChat";

function OrderTracking({ user }) {
  const [orders, setOrders] = useState([]);
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (token) {
      fetch("/api/orders", {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => res.json())
        .then((data) => setOrders(data.orders || []))
        .catch(() => {});
    }
  }, [token]);

  const updateOrderStatus = (orderId, action) => {
    fetch(`/api/orders/${orderId}/action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ action })
    })
      .then((res) => res.json())
      .then((data) => {
        alert(data.message);
        // refresh orders
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: data.newStatus } : o))
        );
      });
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">My Orders</h2>
      {orders.length === 0 && <p>No orders found.</p>}
      {orders.map((order) => (
        <div key={order.id} className="border p-4 mb-6 rounded shadow">
          <h3 className="font-semibold">
            Order #{order.id} – {order.status}
          </h3>
          <p>Product ID: {order.product_id}</p>
          <p>Quantity: {order.quantity}</p>
          <p>Total: ${order.total_amount}</p>

          {/* Role-specific actions */}
          {user?.role === "buyer" && order.status === "delivered" && (
            <>
              <button
                className="bg-green-600 text-white px-3 py-1 mr-2 mt-2 rounded"
                onClick={() => updateOrderStatus(order.id, "confirm")}
              >
                ✅ Confirm & Release Funds
              </button>
              <button
                className="bg-red-600 text-white px-3 py-1 mt-2 rounded"
                onClick={() => updateOrderStatus(order.id, "dispute")}
              >
                ⚠️ Open Dispute
              </button>
            </>
          )}

          {user?.role === "seller" && order.status === "paid" && (
            <button
              className="bg-blue-600 text-white px-3 py-1 mt-2 rounded"
              onClick={() => updateOrderStatus(order.id, "ship")}
            >
              📦 Confirm Shipment
            </button>
          )}

          {user?.role === "logistics" && order.status === "shipped" && (
            <button
              className="bg-purple-600 text-white px-3 py-1 mt-2 rounded"
              onClick={() => updateOrderStatus(order.id, "deliver")}
            >
              🚚 Confirm Delivery
            </button>
          )}

          {user?.role === "admin" && (
            <button
              className="bg-orange-600 text-white px-3 py-1 mt-2 rounded"
              onClick={() => updateOrderStatus(order.id, "override")}
            >
              🛠 Override Order
            </button>
          )}

          {/* Chat Section */}
          <div className="mt-4 border-t pt-2">
            <h4 className="font-semibold mb-2">Chat</h4>
            <OrderChat orderId={order.id} token={token} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default OrderTracking;