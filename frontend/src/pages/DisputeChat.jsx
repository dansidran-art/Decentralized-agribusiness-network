import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

function DisputeChat({ user }) {
  const { id } = useParams(); // disputeId
  const [dispute, setDispute] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);

  useEffect(() => {
    fetch(`/api/disputes/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setDispute(data.dispute);
        setMessages(data.messages || []);
      });
  }, [id]);

  const sendMessage = async () => {
    if (!input && !file) return;

    const formData = new FormData();
    formData.append("message", input);
    if (file) formData.append("file", file);

    const res = await fetch(`/api/disputes/${id}/message`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const newMsg = await res.json();
      setMessages((prev) => [...prev, newMsg]);
      setInput("");
      setFile(null);
    }
  };

  const askAI = async () => {
    const res = await fetch(`/api/disputes/${id}/ai-help`);
    if (res.ok) {
      const aiMsg = await res.json();
      setMessages((prev) => [...prev, { sender: "AI Assistant", message: aiMsg.suggestion }]);
    }
  };

  const closeDispute = async (resolution) => {
    const res = await fetch(`/api/disputes/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution }),
    });
    if (res.ok) {
      alert("Dispute resolved!");
    }
  };

  if (!dispute) return <p>Loading dispute...</p>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Dispute Chat</h1>
      <p className="mb-2">Order ID: {dispute.order_id}</p>
      <p>Status: {dispute.status}</p>

      <div className="border p-4 h-64 overflow-y-scroll bg-gray-100 mb-4">
        {messages.map((m, i) => (
          <div key={i} className="mb-2">
            <strong>{m.sender}:</strong> {m.message}
            {m.file_url && (
              <a
                href={m.file_url}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline ml-2"
              >
                View File
              </a>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 border px-2 py-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
        />
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <button
          onClick={sendMessage}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Send
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={askAI}
          className="px-4 py-2 bg-purple-600 text-white rounded"
        >
          Ask AI Assistant
        </button>
        {(user?.role === "support" || user?.role === "admin") && (
          <>
            <button
              onClick={() => closeDispute("refund")}
              className="px-4 py-2 bg-red-600 text-white rounded"
            >
              Refund Buyer
            </button>
            <button
              onClick={() => closeDispute("release")}
              className="px-4 py-2 bg-green-600 text-white rounded"
            >
              Release Funds to Seller
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default DisputeChat;