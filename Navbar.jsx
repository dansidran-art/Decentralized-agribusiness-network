// frontend/src/components/Navbar.jsx
import React from "react";
import { Link } from "react-router-dom";

function Navbar({ user, onLogout }) {
  return (
    <nav className="bg-green-600 text-white px-4 py-3 flex justify-between items-center">
      <div className="flex space-x-4">
        <Link to="/" className="font-bold hover:text-gray-200">
          AgriNetwork
        </Link>
        <Link to="/" className="hover:text-gray-200">
          Marketplace
        </Link>

        {user && (
          <Link to="/orders" className="hover:text-gray-200">
            My Orders
          </Link>
        )}

        {user?.role === "admin" && (
          <Link to="/admin" className="text-red-300 hover:text-red-100">
            Admin Panel
          </Link>
        )}
      </div>

      <div className="flex space-x-4">
        {user ? (
          <>
            <span className="italic">Hi, {user.name}</span>
            <button
              onClick={onLogout}
              className="bg-red-500 px-3 py-1 rounded hover:bg-red-400"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="hover:text-gray-200">
              Login
            </Link>
            <Link to="/signup" className="hover:text-gray-200">
              Signup
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
<Link to="/ai" className="ml-4 text-green-700">AI Assistant</Link>