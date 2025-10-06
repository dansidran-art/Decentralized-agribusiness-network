import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import KYCVerification from "./pages/KYCVerification";
import SubAccount from "./pages/SubAccount";
import Marketplace from "./pages/Marketplace";
import AdminPanel from "./pages/AdminPanel";
import "./index.css";

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <Router>
      <nav className="bg-green-700 text-white px-6 py-3 flex justify-between items-center shadow-md">
        <Link to="/" className="text-xl font-bold">
          🌾 AgroNet
        </Link>
        <div className="space-x-4">
          {user ? (
            <>
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/subaccount">Subaccount</Link>
              <Link to="/marketplace">Marketplace</Link>
              <Link to="/kyc">KYC</Link>
              {user.role === "admin" && (
                <Link to="/admin" className="text-red-300">Admin</Link>
              )}
              <button onClick={handleLogout} className="ml-3 bg-red-600 px-3 py-1 rounded">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/signup">Signup</Link>
              <Link to="/login">Login</Link>
            </>
          )}
        </div>
      </nav>

      <main className="p-6">
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/signup" element={<Signup setUser={setUser} />} />
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route path="/dashboard" element={<Dashboard user={user} />} />
          <Route path="/kyc" element={<KYCVerification user={user} />} />
          <Route path="/subaccount" element={<SubAccount user={user} />} />
          <Route path="/marketplace" element={<Marketplace user={user} />} />
          <Route path="/admin" element={<AdminPanel user={user} />} />
        </Routes>
      </main>
    </Router>
  );
}