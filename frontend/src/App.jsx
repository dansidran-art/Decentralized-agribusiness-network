import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import TrackingPage from "./pages/TrackingPage";
import AdminPanel from "./pages/AdminPanel";
import DisputeChat from "./pages/DisputeChat";

function App() {
  const [user, setUser] = useState(null);

  return (
    <Router>
      {/* Navbar */}
      <nav className="p-4 bg-gray-200 flex justify-between">
        <Link to="/" className="font-bold">AgriNetwork</Link>
        <div>
          {user ? (
            <>
              <span className="mr-4">Hi, {user.name}</span>
              <Link to="/dashboard" className="mr-4">Dashboard</Link>
              <Link to="/tracking" className="mr-4">Track Orders</Link>
              {user?.role === "admin" && (
                <Link to="/admin" className="ml-4 text-red-600">Admin Panel</Link>
              )}
              <button onClick={() => setUser(null)} className="ml-4">Logout</button>
            </>
          ) : (
            <>
              <Link to="/signup" className="mr-4">Signup</Link>
              <Link to="/login">Login</Link>
            </>
          )}
        </div>
      </nav>

      {/* Routes */}
      <Routes>
        <Route path="/" element={<p>Welcome to AgriNetwork Marketplace</p>} />
        <Route path="/signup" element={<Signup setUser={setUser} />} />
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/dashboard" element={<Dashboard user={user} />} />
        <Route path="/tracking" element={<TrackingPage user={user} />} />
        <Route path="/admin" element={<AdminPanel user={user} />} />
        <Route path="/disputes/:id" element={<DisputeChat user={user} />} />
      </Routes>
    </Router>
  );
}

export default App;