import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import AdminPanel from "./components/AdminPanel";

function App() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  // ✅ Handle input change
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // ✅ Signup
  const handleSignup = async () => {
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Signup successful ✅");
        setUser(data.user);
      } else {
        alert(data.error || "Signup failed");
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  // ✅ Login
  const handleLogin = async () => {
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("Login successful ✅");
        setUser(data.user);
      } else {
        alert(data.error || "Login failed");
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  return (
    <Router>
      <div className="p-4">
        {/* ✅ Navbar */}
        <nav className="mb-4 flex justify-between">
          <Link to="/" className="text-blue-600 font-bold">AgriNetwork</Link>
          <div>
            {user ? (
              <>
                <span className="mr-4">👋 {user.name} ({user.role})</span>
                {user.role === "admin" && (
                  <Link to="/admin" className="ml-4 text-red-600">Admin Panel</Link>
                )}
              </>
            ) : (
              <span className="text-gray-500">Not logged in</span>
            )}
          </div>
        </nav>

        {/* ✅ Routes */}
        <Routes>
          <Route
            path="/"
            element={
              <div>
                <h1 className="text-2xl font-bold mb-4">Welcome to AgriNetwork 🌱</h1>

                {/* Signup Form */}
                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-2">Signup</h2>
                  <input name="name" placeholder="Name" value={form.name} onChange={handleChange} className="border p-2 mr-2"/>
                  <input name="email" placeholder="Email" value={form.email} onChange={handleChange} className="border p-2 mr-2"/>
                  <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} className="border p-2 mr-2"/>
                  <button onClick={handleSignup} className="bg-green-600 text-white px-4 py-2">Signup</button>
                </div>

                {/* Login Form */}
                <div>
                  <h2 className="text-lg font-semibold mb-2">Login</h2>
                  <input name="email" placeholder="Email" value={form.email} onChange={handleChange} className="border p-2 mr-2"/>
                  <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} className="border p-2 mr-2"/>
                  <button onClick={handleLogin} className="bg-blue-600 text-white px-4 py-2">Login</button>
                </div>
              </div>
            }
          />
          <Route path="/admin" element={<AdminPanel user={user} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;