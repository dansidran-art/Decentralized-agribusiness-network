import React, { useEffect, useState } from "react";

const Withdrawals = ({ user }) => {
  const [amount, setAmount] = useState("");
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("token");
    fetch("/api/withdrawals", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setHistory)
      .catch(() => setMessage("Failed to load withdrawals"));
  }, [user]);

  const handleWithdraw = async () => {
    if (!amount || isNaN(amount)) {
      setMessage("Enter a valid amount");
      return;
    }
    const token = localStorage.getItem("token");
    const res = await fetch("/api/withdraw", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount: parseFloat(amount) }),
    });
    const data = await res.json();
    setMessage(data.message || data.error);
    setAmount("");

    // refresh history
    fetch("/api/withdrawals", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setHistory);
  };

  if (!user) return <div className="p-4 text-center">Please log in</div>;

  return (
    <div className="max-w-2xl mx-auto mt-8 bg-white p-6 rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Withdraw Funds</h1>
      <div className="flex gap-2 mb-4">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          className="border p-2 flex-grow rounded"
        />
        <button
          onClick={handleWithdraw}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Withdraw
        </button>
      </div>
      {message && <p className="text-center text-sm text-gray-700">{message}</p>}

      <h2 className="text-xl font-semibold mt-6 mb-2">Withdrawal History</h2>
      <ul className="divide-y divide-gray-200">
        {history.length === 0 ? (
          <p className="text-gray-500">No withdrawals yet</p>
        ) : (
          history.map((w) => (
            <li key={w.id} className="py-2 flex justify-between text-sm">
              <span>${w.amount}</span>
              <span
                className={`${
                  w.status === "completed"
                    ? "text-green-600"
                    : w.status === "pending"
                    ? "text-yellow-600"
                    : "text-red-600"
                }`}
              >
                {w.status}
              </span>
              <span className="text-gray-400">
                {new Date(w.created_at).toLocaleString()}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default Withdrawals;