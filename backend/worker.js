// backend/worker.js
import { Hono } from "hono";
import { cors } from "hono/cors";
import { v4 as uuidv4 } from "uuid";

const app = new Hono();
app.use("*", cors());

// -------------------------
// Helpers
// -------------------------
function nowIso() {
  return new Date().toISOString();
}

async function ensureTables(db) {
  // Creates tables if not exists. Safe to call multiple times.
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      password_hash TEXT,
      role TEXT DEFAULT 'user',
      is_kyc_verified INTEGER DEFAULT 0,
      subaccount_id TEXT,
      account_number TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`),
    db.prepare(`CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT,
      description TEXT,
      price REAL,
      quantity INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`),
    db.prepare(`CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      buyer_id TEXT,
      product_id TEXT,
      seller_id TEXT,
      quantity INTEGER,
      total_amount REAL,
      status TEXT DEFAULT 'created',
      escrow_locked INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`),
    db.prepare(`CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT UNIQUE,
      balance REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`),
    db.prepare(`CREATE TABLE IF NOT EXISTS order_chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT,
      user_id TEXT,
      sender TEXT,
      message TEXT,
      image TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`),
    db.prepare(`CREATE TABLE IF NOT EXISTS subaccounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`)
  ]);
}

function arrayBufferToBase64(buffer) {
  // Works in Cloudflare Workers (btoa + String.fromCharCode)
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function callGeminiPrompt(apiKey, prompt) {
  // Minimal wrapper for Generative Language REST API (Gemini)
  // If apiKey not provided, return null
  if (!apiKey) return null;
  try {
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";
    const res = await fetch(`${url}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return text;
  } catch (e) {
    console.error("Gemini call failed:", e);
    return null;
  }
}

async function simulateAIDecision(context) {
  // Fallback simulation if Gemini key absent
  await new Promise((r) => setTimeout(r, 500));
  if ((context || "").toLowerCase().includes("refund")) {
    return "recommend_refund_to_buyer";
  }
  return "recommend_release_to_seller";
}

// Notification helper (stores in KV if available)
async function notifyKV(c, key, payload) {
  try {
    if (c.env.NOTIFICATIONS_KV) {
      await c.env.NOTIFICATIONS_KV.put(key, JSON.stringify(payload));
    }
  } catch (e) {
    console.warn("KV notify failed:", e);
  }
}

// -------------------------
// Routes
// -------------------------

// Health
app.get("/", (c) => c.text("AgriNetwork Worker running"));

// ---- Signup
app.post("/api/signup", async (c) => {
  const { name, email, password } = await c.req.json();
  if (!email || !password) return c.json({ error: "Missing fields" }, 400);

  await ensureTables(c.env.DB);

  const exists = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (exists) return c.json({ error: "Email already registered" }, 400);

  const id = uuidv4();
  const subaccount_id = `sub_${id.slice(0, 8)}`;
  const account_number = `ACCT${Math.floor(10000000 + Math.random() * 90000000)}`;

  await c.env.DB.prepare(
    "INSERT INTO users (id, name, email, password_hash, subaccount_id, account_number, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(id, name || null, email, password, subaccount_id, account_number, nowIso()).run();

  // create a wallet row
  await c.env.DB.prepare("INSERT INTO wallets (user_id, balance) VALUES (?, ?)").bind(id, 0).run();

  return c.json({ success: true, id, subaccount_id, account_number });
});

// ---- Login
app.post("/api/login", async (c) => {
  const { email, password } = await c.req.json();
  await ensureTables(c.env.DB);
  const user = await c.env.DB.prepare("SELECT id, name, email, role, is_kyc_verified, subaccount_id, account_number FROM users WHERE email = ? AND password_hash = ?")
    .bind(email, password).first();
  if (!user) return c.json({ error: "Invalid credentials" }, 401);
  return c.json({ success: true, user });
});

// ---- KYC Verification (uploads handled on frontend; here we accept URLs or small-base64)
// POST /api/kyc  { userId, idImageUrl, faceImageUrl }
app.post("/api/kyc", async (c) => {
  const { userId, idImageUrl, faceImageUrl } = await c.req.json();
  if (!userId) return c.json({ error: "Missing userId" }, 400);
  await ensureTables(c.env.DB);

  // Build simple prompt for Gemini
  const prompt = `Verify if ID image (${idImageUrl}) matches the selfie (${faceImageUrl}). Reply with only VERIFIED or REJECTED and a short reason.`;

  const aiText = await callGeminiPrompt(c.env.GEMINI_API_KEY, prompt);

  let verified = false;
  if (aiText) {
    verified = aiText.toUpperCase().includes("VERIFIED");
  } else {
    // fallback simulation: accept if both urls present
    verified = !!(idImageUrl && faceImageUrl);
  }

  if (verified) {
    await c.env.DB.prepare("UPDATE users SET is_kyc_verified = 1 WHERE id = ?").bind(userId).run();
    // auto-create subaccount row
    await c.env.DB.prepare("INSERT INTO subaccounts (user_id, name) VALUES (?, ?)").bind(userId, "Primary").run();
  }

  return c.json({ success: true, verified, aiText: aiText || "simulated" });
});

// ---- Products
// GET /api/products
app.get("/api/products", async (c) => {
  await ensureTables(c.env.DB);
  const rows = await c.env.DB.prepare("SELECT * FROM products ORDER BY created_at DESC").all();
  return c.json(rows.results || []);
});

// GET /api/my-products?user_id=...
app.get("/api/my-products", async (c) => {
  const userId = c.req.query("user_id");
  if (!userId) return c.json([], 200);
  await ensureTables(c.env.DB);
  const rows = await c.env.DB.prepare("SELECT * FROM products WHERE user_id = ? ORDER BY created_at DESC").bind(userId).all();
  return c.json(rows.results || []);
});

// POST /api/products
app.post("/api/products", async (c) => {
  const { user_id, name, description, price, quantity } = await c.req.json();
  if (!user_id || !name || price == null) return c.json({ error: "Missing fields" }, 400);
  await ensureTables(c.env.DB);
  const user = await c.env.DB.prepare("SELECT is_kyc_verified FROM users WHERE id = ?").bind(user_id).first();
  if (!user || Number(user.is_kyc_verified) !== 1) return c.json({ error: "KYC required to list products" }, 403);

  const id = uuidv4();
  await c.env.DB.prepare("INSERT INTO products (id, user_id, name, description, price, quantity, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, user_id, name, description || "", price, quantity || 0, nowIso()).run();

  return c.json({ success: true, product: { id, user_id, name, description, price, quantity } });
});

// ---- Orders
// POST /api/orders  { buyer_id, product_id, quantity }
app.post("/api/orders", async (c) => {
  const { buyer_id, product_id, quantity } = await c.req.json();
  if (!buyer_id || !product_id || !quantity) return c.json({ error: "Missing fields" }, 400);
  await ensureTables(c.env.DB);

  const product = await c.env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(product_id).first();
  if (!product) return c.json({ error: "Product not found" }, 404);

  const total = Number(product.price) * Number(quantity);
  const orderId = uuidv4();
  await c.env.DB.prepare("INSERT INTO orders (id, buyer_id, product_id, seller_id, quantity, total_amount, status, escrow_locked, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(orderId, buyer_id, product_id, product.user_id, quantity, total, "paid", 1, nowIso()).run();

  // Notify seller via KV (if available)
  await notifyKV(c, `order_${orderId}`, { userId: product.user_id, message: "New order placed" });

  return c.json({ success: true, orderId, total });
});

// GET /api/orders?user_id=...
app.get("/api/orders", async (c) => {
  const userId = c.req.query("user_id");
  await ensureTables(c.env.DB);
  if (!userId) {
    const all = await c.env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
    return c.json(all.results || []);
  }
  // orders where buyer is user OR seller is user
  const rows = await c.env.DB.prepare(
    `SELECT o.*, p.name AS product_name 
     FROM orders o 
     LEFT JOIN products p ON o.product_id = p.id
     WHERE o.buyer_id = ? OR o.seller_id = ? 
     ORDER BY o.created_at DESC`
  ).bind(userId, userId).all();
  return c.json(rows.results || []);
});

// POST /api/orders/:id/status  { user_id, action }
app.post("/api/orders/:id/status", async (c) => {
  const orderId = c.req.param("id");
  const { user_id, action } = await c.req.json();
  if (!user_id || !action) return c.json({ error: "Missing fields" }, 400);
  await ensureTables(c.env.DB);

  const order = await c.env.DB.prepare("SELECT * FROM orders WHERE id = ?").bind(orderId).first();
  if (!order) return c.json({ error: "Order not found" }, 404);

  // enforce KYC for sensitive actions
  if (action === "release" || action === "dispute") {
    const user = await c.env.DB.prepare("SELECT is_kyc_verified FROM users WHERE id = ?").bind(user_id).first();
    if (!user || Number(user.is_kyc_verified) !== 1) return c.json({ error: "KYC required for this action" }, 403);
  }

  let newStatus = order.status;
  let message = "";

  switch (action) {
    case "ship":
      if (order.status !== "paid") return c.json({ error: "Order not in paid state" }, 400);
      newStatus = "shipped";
      message = "Seller confirmed shipment";
      break;

    case "deliver":
      if (order.status !== "shipped") return c.json({ error: "Order not shipped yet" }, 400);
      newStatus = "delivered";
      message = "Logistics confirmed delivery";
      break;

    case "release":
      // only buyer can release
      if (user_id !== order.buyer_id) return c.json({ error: "Only buyer can release funds" }, 403);
      if (order.status !== "delivered") return c.json({ error: "Order not delivered yet" }, 400);

      newStatus = "completed";
      message = "Buyer confirmed receipt — funds released";

      // credit seller wallet
      await c.env.DB.prepare("INSERT INTO wallets (user_id, balance) SELECT ?, 0 WHERE NOT EXISTS (SELECT 1 FROM wallets WHERE user_id = ?)")
        .bind(order.seller_id, order.seller_id).run();

      await c.env.DB.prepare("UPDATE wallets SET balance = balance + ? WHERE user_id = ?")
        .bind(order.total_amount, order.seller_id).run();

      // unlock escrow
      await c.env.DB.prepare("UPDATE orders SET escrow_locked = 0 WHERE id = ?").bind(orderId).run();
      break;

    case "dispute":
      newStatus = "disputed";
      message = "Dispute opened; AI and admin notified";
      // trigger AI review (async)
      (async () => {
        const context = `Order ${orderId} dispute opened by user ${user_id}. status: ${order.status}`;
        const aiText = await (async () => {
          const prompt = `Analyze this dispute and recommend action (refund/release/escalate). Context: ${context}`;
          const res = await callGeminiPrompt(c.env.GEMINI_API_KEY, prompt);
          if (res) return res;
          return simulateAIDecision(context);
        })();

        // save AI message in chats
        await c.env.DB.prepare("INSERT INTO order_chats (order_id, user_id, sender, message, created_at) VALUES (?, ?, ?, ?, ?)")
          .bind(orderId, "ai", "ai", aiText, nowIso()).run();

        // notify admin/support via KV
        await notifyKV(c, `dispute_${orderId}`, { orderId, aiText });
      })();
      break;

    default:
      return c.json({ error: "Unknown action" }, 400);
  }

  await c.env.DB.prepare("UPDATE orders SET status = ? WHERE id = ?").bind(newStatus, orderId).run();

  // send notifications
  await notifyKV(c, `notif_${uuidv4()}`, { orderId, message });

  return c.json({ success: true, status: newStatus, message });
});

// ---- Chats
// GET /api/orders/chat?order_id=...
app.get("/api/orders/chat", async (c) => {
  const order_id = c.req.query("order_id");
  if (!order_id) return c.json({ messages: [] });
  await ensureTables(c.env.DB);
  const rows = await c.env.DB.prepare("SELECT * FROM order_chats WHERE order_id = ? ORDER BY created_at ASC").bind(order_id).all();
  return c.json({ messages: rows.results || [] });
});

// POST /api/orders/chat  (multipart/form-data: order_id, user_id, message, image)
app.post("/api/orders/chat", async (c) => {
  const form = await c.req.formData();
  const order_id = form.get("order_id");
  const user_id = form.get("user_id");
  const message = form.get("message") || "";
  const file = form.get("image");

  if (!order_id) return c.json({ error: "Missing order_id" }, 400);
  await ensureTables(c.env.DB);

  let imageUrl = null;
  if (file && file.size) {
    const buf = await file.arrayBuffer();
    const b64 = arrayBufferToBase64(buf);
    imageUrl = `data:${file.type};base64,${b64}`;
  }

  await c.env.DB.prepare("INSERT INTO order_chats (order_id, user_id, sender, message, image, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(order_id, user_id || null, user_id ? "user" : "anonymous", message, imageUrl, nowIso()).run();

  // Optionally run AI assistant to add a reply for admin only (not directly visible to buyer)
  // For transparency we store AI reply in chats
  const prompt = `Short helpful response to message: "${message}". Order: ${order_id}`;
  const aiResp = await callGeminiPrompt(c.env.GEMINI_API_KEY, prompt);
  const aiText = aiResp || `Simulated AI reply: received message for order ${order_id}`;

  await c.env.DB.prepare("INSERT INTO order_chats (order_id, user_id, sender, message, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(order_id, "ai", "ai", aiText, nowIso()).run();

  // notify via KV
  await notifyKV(c, `chat_${order_id}_${uuidv4()}`, { order_id, message: message.slice(0, 140) });

  return c.json({ success: true, message: "Saved", aiReply: aiText });
});

// ---- AI Dispute analysis (admin/support usage)
// POST /api/ai/dispute { orderId, context }
app.post("/api/ai/dispute", async (c) => {
  const { orderId, context } = await c.req.json();
  if (!orderId) return c.json({ error: "Missing orderId" }, 400);
  await ensureTables(c.env.DB);

  const prompt = `You are AgriBot, a dispute resolution assistant. Context: ${context}. Provide short recommendation: REFUND/RELEASE/ESCALATE and a reason.`;
  const geminiText = await callGeminiPrompt(c.env.GEMINI_API_KEY, prompt);
  const decision = geminiText || (await simulateAIDecision(context));

  // store AI result
  await c.env.DB.prepare("INSERT INTO order_chats (order_id, user_id, sender, message, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(orderId, "ai", "ai", decision, nowIso()).run();

  // notify admin via KV
  await notifyKV(c, `ai_dispute_${orderId}`, { orderId, decision });

  return c.json({ success: true, decision });
});

// ---- Withdraw (simulated + optional AI check)
app.post("/api/withdraw", async (c) => {
  const { userId, amount, idImageUrl, faceImageUrl } = await c.req.json();
  if (!userId || !amount) return c.json({ error: "Missing fields" }, 400);
  await ensureTables(c.env.DB);

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
  if (!user || Number(user.is_kyc_verified) !== 1) return c.json({ error: "KYC required" }, 403);

  // optional AI identity match
  if (idImageUrl && faceImageUrl) {
    const prompt = `Verify identity for withdrawal: ID ${idImageUrl}, Selfie ${faceImageUrl}. Reply VERIFIED or NOT_VERIFIED.`;
    const res = await callGeminiPrompt(c.env.GEMINI_API_KEY, prompt);
    const ok = res ? res.toUpperCase().includes("VERIFIED") : true; // fallback allow
    if (!ok) return c.json({ error: "AI identity mismatch" }, 403);
  }

  // simulate transfer and return tx
  const tx = `tx_${uuidv4()}`;
  await notifyKV(c, `withdraw_${userId}_${tx}`, { userId, amount, tx });
  return c.json({ success: true, tx, amount });
});
// ===================== ADMIN TEAM MANAGEMENT =====================

// Middleware: Check admin role
async function requireAdmin(c, next) {
  const token = c.req.header("Authorization")?.split(" ")[1];
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
      .bind(payload.userId)
      .first();
    if (!user || user.role !== "admin") return c.json({ error: "Forbidden" }, 403);
    c.set("admin", user);
    await next();
  } catch (err) {
    return c.json({ error: "Invalid token" }, 401);
  }
}

// 🧑‍💼 List all team members (admin + support)
app.get("/api/admin/team", requireAdmin, async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT id, name, email, role, created_at FROM users WHERE role != 'user'"
  ).all();
  return c.json(rows.results);
});

// ➕ Add a new team member
app.post("/api/admin/team", requireAdmin, async (c) => {
  const body = await c.req.json();
  const { name, email, password, role } = body;

  if (!name || !email || !password || !role) {
    return c.json({ error: "Missing fields" }, 400);
  }
  if (!["admin", "support"].includes(role)) {
    return c.json({ error: "Invalid role" }, 400);
  }

  const password_hash = await hashPassword(password);
  try {
    await c.env.DB.prepare(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)"
    ).bind(name, email, password_hash, role).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: "Email already exists or failed" }, 400);
  }
});

// ❌ Remove a team member
app.delete("/api/admin/team/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing id" }, 400);

  const result = await c.env.DB.prepare("DELETE FROM users WHERE id = ? AND role != 'admin'")
    .bind(id)
    .run();

  if (result.success) return c.json({ success: true });
  return c.json({ error: "Unable to delete or user not found" }, 400);
});
export default app;
