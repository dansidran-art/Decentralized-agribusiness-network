import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import KYCPage from "./pages/KYCPage";
import Marketplace from "./pages/Marketplace";
import OrdersPage from "./pages/OrdersPage";
import AdminPanel from "./pages/AdminPanel";
import Withdrawals from "./pages/Withdrawals";
import AIAssistant from "./components/AIAssistant";

const Navbar = ({ user, onLogout }) => (
  <nav className="bg-gray-900 text-white px-4 py-3 flex justify-between items-center">
    <div className="flex gap-4 items-center">
      <Link to="/" className="font-bold text-xl text-green-400">
        AgriNetwork
      </Link>
      {user && (
        <>
          <Link to="/marketplace" className="hover:text-green-400">
            Marketplace
          </Link>
          <Link to="/orders" className="hover:text-green-400">
            Orders
          </Link>
          <Link to="/withdrawals" className="hover:text-green-400">
            Withdraw
          </Link>
          {user.role === "admin" && (
            <Link to="/admin" className="hover:text-red-400">
              Admin Panel
            </Link>
          )}
        </>
      )}
    </div>

    <div>
      {user ? (
        <button
          onClick={onLogout}
          className="bg-red-600 hover:bg-red-700 px-4 py-1 rounded text-sm"
        >
          Logout
        </button>
      ) : (
        <>
          <Link to="/login" className="mr-4 hover:text-green-400">
            Login
          </Link>
          <Link
            to="/signup"
            className="bg-green-600 hover:bg-green-700 px-4 py-1 rounded text-sm"
          >
            Signup
          </Link>
        </>
      )}
    </div>
  </nav>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));

  useEffect(() => {
    const fetchUser = async () => {
      if (!token) return;
      try {
        const res = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchUser();
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setToken(null);
  };

  return (
    <Router>
      <Navbar user={user} onLogout={handleLogout} />
      <main className="p-4 bg-gray-50 min-h-screen">
        <Routes>
          <Route
            path="/"
            element={
              user ? (
                <Navigate to="/marketplace" />
              ) : (
                <div className="text-center mt-16">
                  <h1 className="text-3xl font-bold text-green-700">
                    Welcome to AgriNetwork
                  </h1>
                  <p className="mt-4 text-gray-600">
                    A decentralized marketplace for verified farmers and buyers.
                  </p>
                  <div className="mt-6 space-x-4">
                    <Link
                      to="/signup"
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                    >
                      Get Started
                    </Link>
                    <Link
                      to="/login"
                      className="border border-green-600 text-green-600 px-4 py-2 rounded hover:bg-green-100"
                    >
                      Login
                    </Link>
                  </div>
                </div>
              )
            }
          />
          <Route path="/signup" element={<Signup setToken={setToken} />} />
          <Route path="/login" element={<Login setToken={setToken} />} />
          <Route
            path="/kyc"
            element={user ? <KYCPage user={user} /> : <Navigate to="/login" />}
          />
          <Route
            path="/marketplace"
            element={
              user ? <Marketplace user={user} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/orders"
            element={
              user ? <OrdersPage user={user} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/withdrawals"
            element={
              user ? <Withdrawals user={user} /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/admin"
            element={
              user?.role === "admin" ? (
                <AdminPanel user={user} />
              ) : (
                <Navigate to="/" />
              )
            }
          />
        </Routes>

        {user && <AIAssistant user={user} />}
      </main>
    </Router>
  );
}