import { Hono } from "hono";
import { cors } from "hono/cors";
import { v4 as uuidv4 } from "uuid";

const app = new Hono();

// Enable CORS for frontend access
app.use("*", cors());

// -----------------------------
// 🔐 AUTHENTICATION
// -----------------------------
app.post("/api/signup", async (c) => {
  const { name, email, password } = await c.req.json();
  if (!email || !password) return c.json({ error: "Missing fields" }, 400);

  const existing = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (existing) return c.json({ error: "Email already exists" }, 400);

  await c.env.DB.prepare(
    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
  ).bind(name, email, password).run();

  return c.json({ success: true, message: "Signup successful" });
});

app.post("/api/login", async (c) => {
  const { email, password } = await c.req.json();
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?")
    .bind(email)
    .first();
  if (!user || user.password_hash !== password)
    return c.json({ error: "Invalid credentials" }, 401);

  return c.json({
    success: true,
    user: { id: user.id, name: user.name, role: user.role },
  });
});

// -----------------------------
// 🪪 KYC VERIFICATION (Gemini AI)
// -----------------------------
app.post("/api/kyc/verify", async (c) => {
  const { userId, idImageUrl, faceImageUrl } = await c.req.json();

  const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": c.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Verify if the photo on the ID matches the selfie image. 
          Return only 'verified' or 'not_verified'. ID: ${idImageUrl}, Face: ${faceImageUrl}`,
        }],
      }],
    }),
  }).then((r) => r.json()).catch(() => ({ error: true }));

  const isVerified = aiResponse?.candidates?.[0]?.content?.parts?.[0]?.text?.includes("verified");

  if (isVerified) {
    await c.env.DB.prepare(
      "UPDATE users SET is_kyc_verified = 1 WHERE id = ?"
    ).bind(userId).run();

    // auto-create subaccount
    await c.env.DB.prepare(
      "INSERT INTO subaccounts (user_id, name) VALUES (?, ?)"
    ).bind(userId, "Primary").run();

    return c.json({ verified: true });
  }

  return c.json({ verified: false });
});

// -----------------------------
// 🛒 MARKETPLACE: Products
// -----------------------------
app.get("/api/products", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM products").all();
  return c.json(results);
});

app.post("/api/products", async (c) => {
  const { userId, name, description, price, quantity } = await c.req.json();

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(userId)
    .first();
  if (!user?.is_kyc_verified)
    return c.json({ error: "Only KYC verified users can list products" }, 403);

  await c.env.DB.prepare(
    "INSERT INTO products (user_id, name, description, price, quantity) VALUES (?, ?, ?, ?, ?)"
  ).bind(userId, name, description, price, quantity).run();

  return c.json({ success: true });
});

// -----------------------------
// 💰 ORDERS + ESCROW
// -----------------------------
app.post("/api/orders", async (c) => {
  const { buyerId, productId, quantity } = await c.req.json();

  const product = await c.env.DB.prepare(
    "SELECT * FROM products WHERE id = ?"
  ).bind(productId).first();

  if (!product) return c.json({ error: "Product not found" }, 404);
  const total = product.price * quantity;

  await c.env.DB.prepare(
    "INSERT INTO orders (buyer_id, product_id, quantity, total_amount, status, escrow_locked) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(buyerId, productId, quantity, total, "paid", 1).run();

  await c.env.NOTIFICATIONS_KV.put(
    `order_${uuidv4()}`,
    JSON.stringify({ userId: product.user_id, message: "New order received!" })
  );

  return c.json({ success: true, escrow: "locked", total });
});

// -----------------------------
// 📦 TRACK ORDER STATUS
// -----------------------------
app.get("/api/orders/:userId", async (c) => {
  const { userId } = c.req.param();
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM orders WHERE buyer_id = ? OR product_id IN (SELECT id FROM products WHERE user_id = ?)"
  ).bind(userId, userId).all();
  return c.json(results);
});

// -----------------------------
// 🤖 AI DISPUTE BOT (Admin/Support Only)
// -----------------------------
app.post("/api/ai/dispute", async (c) => {
  const { orderId, userMessage } = await c.req.json();

  const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": c.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `You are an AI dispute resolver for an agriculture marketplace. 
          Analyze and suggest a fair resolution for this dispute:
          ${userMessage}`,
        }],
      }],
    }),
  }).then((r) => r.json());

  const botReply =
    aiResponse?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "I could not process this dispute, please escalate.";

  await c.env.NOTIFICATIONS_KV.put(
    `dispute_${uuidv4()}`,
    JSON.stringify({ orderId, message: botReply })
  );

  return c.json({ success: true, botReply });
});

// -----------------------------
// 🏦 WITHDRAWALS (Simulated + AI validation)
// -----------------------------
app.post("/api/withdraw", async (c) => {
  const { userId, amount, idImageUrl, faceImageUrl } = await c.req.json();

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(userId)
    .first();

  if (!user?.is_kyc_verified)
    return c.json({ error: "KYC verification required" }, 403);

  // AI check before release
  const verify = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": c.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `Verify withdrawal identity. Match: ${idImageUrl} with ${faceImageUrl}. Respond with 'verified' or 'not_verified'.`,
        }],
      }],
    }),
  }).then((r) => r.json());

  const ok = verify?.candidates?.[0]?.content?.parts?.[0]?.text?.includes("verified");
  if (!ok) return c.json({ error: "AI identity mismatch — withdrawal denied" }, 403);

  return c.json({ success: true, message: "Withdrawal approved & simulated!" });
});

// -----------------------------
app.get("/", (c) => c.text("🌾 AgriNetwork Worker running successfully!"));
// -----------------------------

export default app;