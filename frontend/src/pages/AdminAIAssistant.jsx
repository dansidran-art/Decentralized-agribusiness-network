import { useState } from "react";

export default function AdminAIAssistant({ user }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  if (!user || (user.role !== "admin" && user.role !== "support")) {
    return <div className="p-6 text-red-500">Access denied</div>;
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim()) return;

    const newMsg = { sender: "You", text: input };
    setMessages([...messages, newMsg]);
    setLoading(true);

    const res = await fetch("/api/ai/assistant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ message: input }),
    });

    const data = await res.json();
    setLoading(false);
    setMessages((prev) => [
      ...prev,
      { sender: "AI Assistant", text: data.reply || data.error },
    ]);
    setInput("");
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">🤖 AI Assistant (Gemini)</h1>
      <div className="border rounded p-4 h-96 overflow-y-auto mb-4 bg-gray-50">
        {messages.map((m, i) => (
          <div key={i} className="mb-2">
            <strong>{m.sender}: </strong>
            <span>{m.text}</span>
          </div>
        ))}
        {loading && <div className="text-gray-500">AI is thinking...</div>}
      </div>
      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          className="border p-2 flex-1"
          placeholder="Ask AI (e.g., resolve a dispute about missing shipment)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
          disabled={loading}
        >
          Send
        </button>
      </form>
    </div>
  );
}