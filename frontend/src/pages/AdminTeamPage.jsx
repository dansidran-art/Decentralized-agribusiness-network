import { useEffect, useState } from "react";

export default function AdminTeamPage({ user }) {
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "support" });
  const [loading, setLoading] = useState(false);

  async function fetchMembers() {
    const res = await fetch("/api/admin/team", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (res.ok) setMembers(await res.json());
  }

  async function handleAdd(e) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/admin/team", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) {
      setForm({ name: "", email: "", password: "", role: "support" });
      fetchMembers();
      alert("Team member added!");
    } else alert("Failed to add member");
  }

  async function handleDelete(id) {
    if (!confirm("Remove this member?")) return;
    const res = await fetch(`/api/admin/team/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (res.ok) {
      fetchMembers();
      alert("Removed successfully");
    }
  }

  useEffect(() => {
    if (user?.role === "admin") fetchMembers();
  }, [user]);

  if (user?.role !== "admin")
    return <div className="p-4 text-red-500">Access denied</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Team Management</h1>

      <form onSubmit={handleAdd} className="mb-6 space-y-2">
        <input
          type="text"
          placeholder="Name"
          className="border p-2 w-full"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          type="email"
          placeholder="Email"
          className="border p-2 w-full"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          type="password"
          placeholder="Password"
          className="border p-2 w-full"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <select
          className="border p-2 w-full"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option value="support">Support</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          {loading ? "Adding..." : "Add Member"}
        </button>
      </form>

      <table className="min-w-full border">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2 border">Name</th>
            <th className="p-2 border">Email</th>
            <th className="p-2 border">Role</th>
            <th className="p-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td className="p-2 border">{m.name}</td>
              <td className="p-2 border">{m.email}</td>
              <td className="p-2 border">{m.role}</td>
              <td className="p-2 border">
                {m.role !== "admin" && (
                  <button
                    className="text-red-600"
                    onClick={() => handleDelete(m.id)}
                  >
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}