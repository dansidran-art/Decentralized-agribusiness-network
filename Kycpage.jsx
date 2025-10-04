import React, { useState } from "react";

export default function KYCPage({ user }) {
  const [idImage, setIdImage] = useState("");
  const [selfie, setSelfie] = useState("");
  const [status, setStatus] = useState("");

  const submitKYC = async () => {
    const res = await fetch("/api/verify/kyc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        idImageUrl: idImage,
        selfieImageUrl: selfie,
      }),
    });
    const data = await res.json();
    setStatus(data.message);
  };

  return (
    <div className="max-w-lg mx-auto mt-8 bg-white p-6 rounded shadow">
      <h2 className="text-xl font-semibold mb-4">KYC Verification</h2>
      <input
        type="text"
        placeholder="Upload ID image URL"
        className="w-full border p-2 mb-3 rounded"
        onChange={(e) => setIdImage(e.target.value)}
      />
      <input
        type="text"
        placeholder="Upload Selfie image URL"
        className="w-full border p-2 mb-3 rounded"
        onChange={(e) => setSelfie(e.target.value)}
      />
      <button
        onClick={submitKYC}
        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
      >
        Submit for AI Verification
      </button>
      {status && <p className="mt-4 text-gray-700">{status}</p>}
    </div>
  );
}