import React, { useState } from "react";

export default function Withdrawals({ user }) {
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");

  const handleWithdraw = async () => {
    const res = await fetch("/api/verify/withdrawal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, amount }),
    });
    const data = await res.json();
    setStatus(data.message);
  };

  return (
    <div className="max-w-lg mx-auto mt-8 bg-white p-6 rounded shadow">
      <h2 className="text-xl font-semibold mb-4">Withdrawal Request</h2>
      <input
        type="number"
        placeholder="Enter amount"
        className="w-full border p-2 mb-3 rounded"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button
        onClick={handleWithdraw}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
      >
        Submit Withdrawal
      </button>
      {status && <p className="mt-4 text-gray-700">{status}</p>}
    </div>
  );
}