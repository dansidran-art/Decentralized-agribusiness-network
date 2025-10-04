import React, { useState } from "react";

export default function AiAssistant({ user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const sendMessage = async () => {
    if (!input.trim()) return;
    const newMessages = [...messages, { sender: "user", text: input }];
    setMessages(newMessages);
    setInput("");

    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user?.id || 0,
        message: input,
        role: user?.role || "guest",
      }),
    });

    const data = await res.json();
    if (data.success) {
      setMessages([...newMessages, { sender: "ai", text: data.reply }]);
    } else {
      setMessages([...newMessages, { sender: "ai", text: "AI error, please try again." }]);
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-8 bg-white p-6 rounded shadow flex flex-col h-[70vh]">
      <h2 className="text-xl font-semibold mb-4 text-center">🌾 AgriBot Assistant</h2>
      <div className="flex-1 overflow-y-auto border p-3 rounded mb-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-2 ${
              msg.sender === "user" ? "text-right" : "text-left"
            }`}
          >
            <span
              className={`inline-block p-2 rounded-lg ${
                msg.sender === "user"
                  ? "bg-green-200 text-gray-800"
                  : "bg-gray-200 text-gray-800"
              }`}
            >
              {msg.text}
            </span>
          </div>
        ))}
      </div>
      <div className="flex">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AgriBot anything..."
          className="flex-1 border p-2 rounded-l"
        />
        <button
          onClick={sendMessage}
          className="bg-green-600 hover:bg-green-700 text-white px-4 rounded-r"
        >
          Send
        </button>
      </div>
    </div>
  );
}