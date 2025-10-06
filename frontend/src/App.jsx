import React, { useState } from "react";

export default function App() {
  const [userId, setUserId] = useState("");
  const [verified, setVerified] = useState(false);
  const [amount, setAmount] = useState("");

  const uploadKYC = async () => {
    const res = await fetch("/api/kyc/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        documentImage: "fake-doc",
        selfieImage: "fake-selfie",
      }),
    });
    const data = await res.json();
    setVerified(data.success);
  };

  const withdraw = async () => {
    const res = await fetch("/api/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, amount }),
    });
    const data = await res.json();
    alert(data.message || data.error);
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">AgriNetwork Dashboard</h1>

      <input
        type="text"
        placeholder="Enter User ID"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="border p-2 w-full mb-2"
      />

      {!verified ? (
        <button onClick={uploadKYC} className="bg-green-600 text-white p-2 rounded w-full">
          Verify KYC
        </button>
      ) : (
        <p className="text-green-700 mt-2">KYC Verified ✅</p>
      )}

      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="border p-2 w-full mt-4 mb-2"
      />
      <button onClick={withdraw} className="bg-blue-600 text-white p-2 rounded w-full">
        Withdraw
      </button>
    </div>
  );
}