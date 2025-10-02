import { Hono } from "hono";
import { cors } from "hono/cors";
import { jwt } from "hono/jwt";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";

// JWT secret
const JWT_SECRET = "supersecret";

// Helper: Create JWT
function createJWT(user) {
  return jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

// Helper: Verify JWT
function verifyJWT(token) {
  return jwt.verify(token, JWT_SECRET);
}

const app = new Hono();
app.use("*", cors());

// ---------------- AUTH ----------------
app.post("/api/signup", async (c) => {
  const { name, email, password } = await c.req.json();
  const hash = await bcrypt.hash(password, 10);

  // Insert user
  const { success, error } = await c.env.DB.prepare(
    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
  )
    .bind(name, email, hash)
    .run();

  if (!success) return c.json({ error }, 400);

  // Auto-create subaccount
  const { results } = await c.env.DB.prepare(
    "SELECT id FROM users WHERE email = ?"
  )
    .bind(email)
    .all();

  if (results && results.length > 0) {
    await c.env.DB.prepare(
      "INSERT INTO subaccounts (user_id, name, balance) VALUES (?, ?, 0)"
    )
      .bind(results[0].id, `${name}'s account`)
      .run();
  }

  return c.json({ message: "User created. Please login." });
});

app.post("/api/login", async (c) => {
  const { email, password } = await c.req.json();
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM users WHERE email = ?"
  )
    .bind(email)
    .all();

  if (!results || results.length === 0)
    return c.json({ error: "Invalid credentials" }, 401);

  const user = results[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return c.json({ error: "Invalid credentials" }, 401);

  const token = createJWT(user);
  return c.json({ token, user });
});

// ---------------- KYC ----------------
app.post("/api/kyc", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  let payload;
  try {
    payload = verifyJWT(auth.split(" ")[1]);
  } catch (e) {
    return c.json({ error: "Invalid token" }, 401);
  }

  // Simulate Gemini AI KYC verification
  const { docImage, faceImage } = await c.req.json();
  if (!docImage || !faceImage)
    return c.json({ error: "Document & face required" }, 400);

  // Fake AI call
  const verified = true; // Assume success
  if (verified) {
    await c.env.DB.prepare(
      "UPDATE users SET is_kyc_verified = 1 WHERE id = ?"
    )
      .bind(payload.userId)
      .run();
    return c.json({ success: true, message: "KYC Verified" });
  }

  return c.json({ error: "KYC failed" }, 400);
});

// ---------------- PRODUCTS ----------------
app.post("/api/products", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  let payload;
  try {
    payload = verifyJWT(auth.split(" ")[1]);
  } catch (e) {
    return c.json({ error: "Invalid token" }, 401);
  }

  // Only KYC verified users can list
  const { results } = await c.env.DB.prepare(
    "SELECT is_kyc_verified FROM users WHERE id = ?"
  )
    .bind(payload.userId)
    .all();
  if (!results[0].is_kyc_verified)
    return c.json({ error: "KYC required" }, 403);

  const { name, description, price, quantity } = await c.req.json();
  await c.env.DB.prepare(
    "INSERT INTO products (user_id, name, description, price, quantity) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(payload.userId, name, description, price, quantity)
    .run();

  return c.json({ success: true, message: "Product added" });
});

app.get("/api/products", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM products").all();
  return c.json(results);
});

// ---------------- ORDERS + ESCROW ----------------
app.post("/api/orders", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  let payload;
  try {
    payload = verifyJWT(auth.split(" ")[1]);
  } catch (e) {
    return c.json({ error: "Invalid token" }, 401);
  }

  const { productId, quantity } = await c.req.json();
  const { results } = await c.env.DB.prepare(
    "SELECT price FROM products WHERE id = ?"
  )
    .bind(productId)
    .all();

  if (!results || results.length === 0)
    return c.json({ error: "Product not found" }, 404);

  const total = results[0].price * quantity;

  await c.env.DB.prepare(
    "INSERT INTO orders (buyer_id, product_id, quantity, total_amount, status, escrow_locked) VALUES (?, ?, ?, ?, 'paid', 1)"
  )
    .bind(payload.userId, productId, quantity, total)
    .run();

  return c.json({ success: true, message: "Order placed, funds in escrow" });
});

app.post("/api/orders/:id/action", async (c) => {
  const orderId = c.req.param("id");
  const { action } = await c.req.json();

  const auth = c.req.header("Authorization");
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  let payload;
  try {
    payload = verifyJWT(auth.split(" ")[1]);
  } catch (e) {
    return c.json({ error: "Invalid token" }, 401);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM orders WHERE id = ?"
  )
    .bind(orderId)
    .all();
  if (!results || results.length === 0)
    return c.json({ error: "Order not found" }, 404);

  const order = results[0];
  let newStatus = order.status;

  // 🛍️ Seller confirms shipment
  if (payload.role === "user" && action === "ship") {
    newStatus = "shipped";
  }

  // 🚚 Logistics confirms delivery
  if (payload.role === "logistics" && action === "deliver") {
    newStatus = "delivered";
  }

  // 🛒 Buyer confirms receipt
  if (payload.role === "buyer") {
    if (action === "confirm" && order.status === "delivered") {
      newStatus = "completed";

      // 💰 Release escrow into seller’s subaccount
      await c.env.DB.prepare(
        "UPDATE subaccounts SET balance = balance + ? WHERE user_id = (SELECT user_id FROM products WHERE id = ?)"
      )
        .bind(order.total_amount, order.product_id)
        .run();
    }
    if (action === "dispute") {
      newStatus = "disputed";
    }
  }

  await c.env.DB.prepare("UPDATE orders SET status = ? WHERE id = ?")
    .bind(newStatus, orderId)
    .run();

  return c.json({ success: true, status: newStatus });
});

// ---------------- BALANCE ----------------
app.get("/api/balance", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  let payload;
  try {
    payload = verifyJWT(auth.split(" ")[1]);
  } catch (e) {
    return c.json({ error: "Invalid token" }, 401);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT balance FROM subaccounts WHERE user_id = ?"
  )
    .bind(payload.userId)
    .all();

  if (!results || results.length === 0)
    return c.json({ error: "No subaccount found" }, 404);

  return c.json({ balance: results[0].balance });
});

// ---------------- NOTIFICATIONS ----------------
app.get("/api/notifications", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  let payload;
  try {
    payload = verifyJWT(auth.split(" ")[1]);
  } catch (e) {
    return c.json({ error: "Invalid token" }, 401);
  }

  const { results } = await c.env.DB.prepare(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC"
  )
    .bind(payload.userId)
    .all();

  return c.json(results);
});

export default app;