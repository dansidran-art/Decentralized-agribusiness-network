import React, { useState, useEffect } from "react";

export default function DisputeChat({ orderId, user }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [file, setFile] = useState(null);

  // Load messages
  useEffect(() => {
    fetch(`/api/disputes/${orderId}`)
      .then(res => res.json())
      .then(data => {
        if (data.messages) {
          setMessages(data.messages);
        }
      });
  }, [orderId]);

  // Send message (with optional file)
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage && !file) return;

    const formData = new FormData();
    formData.append("message", newMessage);
    if (file) formData.append("image", file);

    const res = await fetch(`/api/disputes/${orderId}/messages`, {
      method: "POST",
      body: formData,
    });

    const msg = await res.json();
    setMessages([...messages, msg]);

    setNewMessage("");
    setFile(null);
  };

  return (
    <div className="p-4 border rounded bg-white">
      <h2 className="text-xl font-bold mb-2">Dispute Chat</h2>

      <div className="h-64 overflow-y-auto border p-2 mb-3">
        {messages.length === 0 && (
          <p className="text-gray-500">No messages yet.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="mb-2">
            <strong>{m.name || `User ${m.user_id}`}:</strong>{" "}
            <span>{m.message}</span>
            {m.image_key && (
              <div>
                <img
                  src={`/api/disputes/${orderId}/images/${m.image_key.split("/").pop()}`}
                  alt="uploaded"
                  className="mt-1 max-w-xs border"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={sendMessage} className="flex flex-col gap-2">
        <textarea
          className="border p-2 rounded"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files[0])}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white py-1 px-3 rounded"
        >
          Send
        </button>
      </form>
    </div>
  );
}