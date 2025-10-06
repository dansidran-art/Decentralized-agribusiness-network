import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import AdminPanel from "./pages/AdminPanel";
import Tracking from "./pages/Tracking";
import Marketplace from "./pages/Marketplace";
import SubAccount from "./pages/SubAccount";
import KYC from "./pages/KYC";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <Router>
      <nav className="p-4 bg-green-700 text-white flex justify-between">
        <div>
          <Link to="/" className="font-bold">AgriNetwork</Link>
          <Link to="/marketplace" className="ml-4">Marketplace</Link>
          {user && (
            <>
              <Link to="/subaccount" className="ml-4">SubAccount</Link>
              <Link to="/tracking" className="ml-4">Tracking</Link>
              <Link to="/kyc" className="ml-4">KYC</Link>
              {user.role === "admin" && (
                <Link to="/admin" className="ml-4 text-yellow-300">Admin</Link>
              )}
            </>
          )}
        </div>
        <div>
          {user ? (
            <button onClick={handleLogout}>Logout</button>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/signup" className="ml-4">Signup</Link>
            </>
          )}
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Marketplace />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/kyc" element={<KYC user={user} />} />
        <Route path="/subaccount" element={<SubAccount user={user} />} />
        <Route path="/tracking" element={<Tracking user={user} />} />
        <Route path="/admin" element={<AdminPanel user={user} />} />
      </Routes>
    </Router>
  );
}