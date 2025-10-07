import React, { useState, useEffect } from "react";
import MarketplacePage from "./pages/MarketplacePage";
import KYCPage from "./pages/KYCPage";
import OrdersPage from "./pages/OrdersPage";
import AdminPanel from "./pages/AdminPanel";
import SubAccountPage from "./pages/SubAccountPage";

const API = import.meta.env.VITE_API_URL || "http://localhost:8787";

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("marketplace");
  const [products, setProducts] = useState([]);

  // 🔹 Load products from backend
  useEffect(() => {
    fetch(`${API}/api/products`)
      .then((res) => res.json())
      .then(setProducts)
      .catch(() => {});
  }, []);

  const handleLogin = async (email, password) => {
    const res = await fetch(`${API}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.success) setUser(data.user);
  };

  const handleSignup = async (name, email, password) => {
    const res = await fetch(`${API}/api/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (data.success) alert("Signup complete! Please login.");
  };

  const logout = () => setUser(null);

  const renderPage = () => {
    if (!user)
      return (
        <div className="p-6 max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-4">AgriNetwork</h1>
          <AuthForm onLogin={handleLogin} onSignup={handleSignup} />
        </div>
      );

    switch (page) {
      case "kyc":
        return <KYCPage user={user} />;
      case "subaccount":
        return <SubAccountPage user={user} />;
      case "orders":
        return <OrdersPage user={user} />;
      case "admin":
        return user.role === "admin" ? <AdminPanel user={user} /> : <p>Access denied.</p>;
      default:
        return <MarketplacePage user={user} products={products} />;
    }
  };

  return (
    <div className="min-h-screen bg-green-50">
      <header className="bg-green-700 text-white p-4 flex justify-between">
        <h1 className="font-bold">🌾 AgriNetwork</h1>
        {user && (
          <nav className="space-x-3">
            <button onClick={() => setPage("marketplace")}>Marketplace</button>
            <button onClick={() => setPage("orders")}>Orders</button>
            <button onClick={() => setPage("kyc")}>KYC</button>
            <button onClick={() => setPage("subaccount")}>SubAccount</button>
            {user.role === "admin" && <button onClick={() => setPage("admin")}>Admin</button>}
            <button onClick={logout}>Logout</button>
          </nav>
        )}
      </header>
      <main className="p-6">{renderPage()}</main>
    </div>
  );
}

// -----------------------------
// 🔐 AUTH COMPONENT
// -----------------------------
function AuthForm({ onLogin, onSignup }) {
  const [isSignup, setIsSignup] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    isSignup ? onSignup(form.name, form.email, form.password) : onLogin(form.email, form.password);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-md space-y-3">
      {isSignup && (
        <input
          type="text"
          placeholder="Name"
          className="w-full border p-2 rounded"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      )}
      <input
        type="email"
        placeholder="Email"
        className="w-full border p-2 rounded"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <input
        type="password"
        placeholder="Password"
        className="w-full border p-2 rounded"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />
      <button className="bg-green-700 text-white px-4 py-2 rounded w-full">
        {isSignup ? "Sign Up" : "Login"}
      </button>
      <p className="text-center text-sm text-gray-600">
        {isSignup ? "Already have an account?" : "Need an account?"}{" "}
        <span
          onClick={() => setIsSignup(!isSignup)}
          className="text-green-700 font-semibold cursor-pointer"
        >
          {isSignup ? "Login" : "Sign Up"}
        </span>
      </p>
    </form>
  );
}
import AdminTeamPage from "./pages/AdminTeamPage";

<Route path="/admin/team" element={<AdminTeamPage user={user} />} />