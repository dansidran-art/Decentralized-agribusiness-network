import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Signup from "./components/Signup";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import AdminPanel from "./components/AdminPanel";
import OrderTracking from "./components/OrderTracking";
import OrderChat from "./components/OrderChat";

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || "");

  useEffect(() => {
    if (token) {
      // Decode or fetch user details
      fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.json())
        .then((data) => {
          if (data.user) setUser(data.user);
        })
        .catch(() => {});
    }
  }, [token]);

  const handleLogout = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
  };

  return (
    <Router>
      <nav className="bg-green-700 text-white p-4 flex justify-between">
        <Link to="/" className="font-bold">AgriNetwork</Link>
        <div>
          {user ? (
            <>
              <Link to="/dashboard" className="ml-4">Dashboard</Link>
              <Link to="/orders" className="ml-4">Track Orders</Link>
              {user?.role === "admin" && (
                <Link to="/admin" className="ml-4 text-red-300">Admin Panel</Link>
              )}
              <button onClick={handleLogout} className="ml-4 bg-red-600 px-2 py-1 rounded">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/signup" className="ml-4">Signup</Link>
              <Link to="/login" className="ml-4">Login</Link>
            </>
          )}
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<h1 className="p-6">Welcome to AgriNetwork 🌱</h1>} />
        <Route path="/signup" element={<Signup setToken={setToken} />} />
        <Route path="/login" element={<Login setToken={setToken} />} />
        <Route path="/dashboard" element={<Dashboard user={user} />} />
        <Route path="/orders" element={
          <div className="p-6">
            <h2 className="text-xl font-bold">Order Tracking</h2>
            {/* Example orderId=1, replace with real ID from backend */}
            <OrderTracking user={user} />
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Chat with Buyer/Seller/Logistics</h3>
              <OrderChat orderId={1} token={token} />
            </div>
          </div>
        } />
        <Route path="/admin" element={<AdminPanel user={user} />} />
      </Routes>
    </Router>
  );
}

export default App;