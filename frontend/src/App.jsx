import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from "react-router-dom";

// --- API Helper ---
const api = async (url, method = "GET", body = null, token = null) => {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : null
  });
  return res.json();
};

// --- Navbar ---
const Navbar = ({ user, setUser }) => {
  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <nav className="p-4 bg-green-700 text-white flex justify-between">
      <div>
        <Link to="/" className="mr-4">Home</Link>
        {user ? (
          <>
            <Link to="/products" className="mr-4">Marketplace</Link>
            <Link to="/orders" className="mr-4">Orders</Link>
            <Link to="/kyc" className="mr-4">KYC</Link>
            {user.role === "admin" && (
              <Link to="/admin" className="mr-4 text-red-300">Admin Panel</Link>
            )}
            <button onClick={logout} className="bg-red-600 px-2 py-1 rounded">Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" className="mr-4">Login</Link>
            <Link to="/signup" className="mr-4">Signup</Link>
          </>
        )}
      </div>
    </nav>
  );
};

// --- Signup ---
const Signup = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const submit = async () => {
    await api("/signup", "POST", form);
    navigate("/login");
  };

  return (
    <div className="p-4">
      <h2>Signup</h2>
      <input placeholder="Name" onChange={e => setForm({ ...form, name: e.target.value })} />
      <input placeholder="Email" onChange={e => setForm({ ...form, email: e.target.value })} />
      <input type="password" placeholder="Password" onChange={e => setForm({ ...form, password: e.target.value })} />
      <button onClick={submit}>Signup</button>
    </div>
  );
};

// --- Login ---
const Login = ({ setUser }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });

  const submit = async () => {
    const res = await api("/login", "POST", form);
    if (res.token) {
      localStorage.setItem("token", res.token);
      setUser({ ...form, role: "user" }); // simplified
      navigate("/");
    }
  };

  return (
    <div className="p-4">
      <h2>Login</h2>
      <input placeholder="Email" onChange={e => setForm({ ...form, email: e.target.value })} />
      <input type="password" placeholder="Password" onChange={e => setForm({ ...form, password: e.target.value })} />
      <button onClick={submit}>Login</button>
    </div>
  );
};

// --- KYC Upload ---
const KYC = ({ user }) => {
  const [doc, setDoc] = useState("");
  const [selfie, setSelfie] = useState("");
  const [status, setStatus] = useState("");

  const submit = async () => {
    const res = await api("/kyc", "POST", {
      userId: 1, // demo only
      documentImage: doc,
      selfieImage: selfie
    });
    setStatus(res.verified ? "✅ Verified" : "❌ Failed");
  };

  return (
    <div className="p-4">
      <h2>KYC Verification</h2>
      <input placeholder="Doc Image URL" onChange={e => setDoc(e.target.value)} />
      <input placeholder="Selfie Image URL" onChange={e => setSelfie(e.target.value)} />
      <button onClick={submit}>Submit KYC</button>
      <p>{status}</p>
    </div>
  );
};

// --- Marketplace ---
const Products = ({ user }) => {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ name: "", description: "", price: 0, quantity: 1 });

  useEffect(() => {
    api("/products").then(setProducts);
  }, []);

  const add = async () => {
    await api("/products", "POST", { ...form, userId: 1 });
    const updated = await api("/products");
    setProducts(updated);
  };

  return (
    <div className="p-4">
      <h2>Marketplace</h2>
      {user?.is_kyc_verified && (
        <div>
          <input placeholder="Name" onChange={e => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Description" onChange={e => setForm({ ...form, description: e.target.value })} />
          <input type="number" placeholder="Price" onChange={e => setForm({ ...form, price: +e.target.value })} />
          <input type="number" placeholder="Qty" onChange={e => setForm({ ...form, quantity: +e.target.value })} />
          <button onClick={add}>Add Product</button>
        </div>
      )}
      <ul>
        {products.map(p => (
          <li key={p.id}>{p.name} - ${p.price} (Qty: {p.quantity})</li>
        ))}
      </ul>
    </div>
  );
};

// --- Orders ---
const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [pid, setPid] = useState("");

  const create = async () => {
    await api("/orders", "POST", { buyerId: 1, productId: +pid, quantity: 1 });
    setOrders(await api("/orders"));
  };

  return (
    <div className="p-4">
      <h2>Orders</h2>
      <input placeholder="Product ID" onChange={e => setPid(e.target.value)} />
      <button onClick={create}>Buy</button>
      <ul>
        {orders.map(o => (
          <li key={o.id}>{o.status} - ${o.total_amount}</li>
        ))}
      </ul>
    </div>
  );
};

// --- Admin Panel ---
const AdminPanel = () => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api("/admin/users").then(setUsers);
  }, []);

  return (
    <div className="p-4">
      <h2>Admin Panel</h2>
      <ul>
        {users.map(u => (
          <li key={u.id}>
            {u.email} - {u.role} - KYC: {u.is_kyc_verified ? "✅" : "❌"}
          </li>
        ))}
      </ul>
    </div>
  );
};

// --- Root App ---
const App = () => {
  const [user, setUser] = useState(null);

  return (
    <Router>
      <Navbar user={user} setUser={setUser} />
      <Routes>
        <Route path="/" element={<h1>Welcome to AgriNetwork 🌾</h1>} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/kyc" element={<KYC user={user} />} />
        <Route path="/products" element={<Products user={user} />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </Router>
  );
};

export default App;