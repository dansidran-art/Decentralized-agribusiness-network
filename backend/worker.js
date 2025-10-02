// backend/worker.js
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bearerAuth } from "hono/bearer-auth";
import { drizzle } from "drizzle-orm/d1";

const app = new Hono();

app.use("*", cors());

// Middleware for auth
app.use("/api/*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader) return c.json({ error: "Unauthorized" }, 401);

  const token = authHeader.replace("Bearer ", "");
  try {
    const user = JSON.parse(atob(token.split(".")[1])); // simple JWT decode
    c.set("user", user);
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
});

// DB helper
function getDB(c) {
  return drizzle(c.env.DB);
}

/**
 * ========================
 * ORDERS CHAT + IMAGE UPLOAD
 * ========================
 */

// fetch messages for order
app.get("/api/orders/:id/chat", async (c) => {
  const db = getDB(c);
  const orderId = c.req.param("id");

  const rows = await db
    .prepare("SELECT * FROM order_chats WHERE order_id = ? ORDER BY created_at ASC")
    .bind(orderId)
    .all();

  return c.json(rows.results || []);
});

// send message (text + optional image)
app.post("/api/orders/:id/chat", async (c) => {
  const db = getDB(c);
  const orderId = c.req.param("id");
  const user = c.get("user");

  const body = await c.req.parseBody();

  const message = body["message"] || null;
  let image_url = null;

  if (body["image"]) {
    // Store in Cloudflare R2 bucket
    const file = body["image"];
    const key = `chat/${orderId}/${Date.now()}-${file.name}`;
    await c.env.R2_BUCKET.put(key, file.stream());
    image_url = `https://${c.env.R2_BUCKET_NAME}.r2.cloudflarestorage.com/${key}`;
  }

  await db
    .prepare(
      "INSERT INTO order_chats (order_id, sender, message, image_url) VALUES (?, ?, ?, ?)"
    )
    .bind(orderId, user.email, message, image_url)
    .run();

  return c.json({ success: true });
});

/**
 * ========================
 * ORDERS (basic list for tracking page)
 * ========================
 */
app.get("/api/orders", async (c) => {
  const db = getDB(c);
  const user = c.get("user");

  const rows = await db
    .prepare(
      "SELECT o.*, p.name as product_name FROM orders o JOIN products p ON o.product_id = p.id WHERE o.buyer_id = ? OR p.user_id = ?"
    )
    .bind(user.id, user.id)
    .all();

  return c.json(rows.results || []);
});

export default app;
// Handle role-based order actions
app.post("/api/orders/:id/action", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  let payload;
  try {
    payload = verifyJWT(auth.split(" ")[1]);
  } catch (e) {
    return c.json({ error: "Invalid token" }, 401);
  }

  const { id } = c.req.param();
  const { action } = await c.req.json();

  // fetch current order
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM orders WHERE id = ?"
  ).bind(id).all();

  if (!results || results.length === 0) {
    return c.json({ error: "Order not found" }, 404);
  }

  const order = results[0];
  let newStatus = order.status;

  // Role-based transitions
  if (payload.role === "buyer") {
    if (action === "confirm" && order.status === "delivered") {
      newStatus = "completed"; // release escrow
    }
    if (action === "dispute" && order.status === "delivered") {
      newStatus = "disputed";
    }
  }

  if (payload.role === "seller") {
    if (action === "ship" && order.status === "paid") {
      newStatus = "shipped";
    }
  }

  if (payload.role === "logistics") {
    if (action === "deliver" && order.status === "shipped") {
      newStatus = "delivered";
    }
  }

  if (payload.role === "admin" || payload.role === "support") {
    if (action === "override") {
      newStatus = "overridden";
    }
  }

  if (newStatus === order.status) {
    return c.json({ message: "Invalid action for current status" }, 400);
  }

  // update order status
  await c.env.DB.prepare(
    "UPDATE orders SET status = ? WHERE id = ?"
  ).bind(newStatus, id).run();

  return c.json({ message: `Order updated to ${newStatus}`, newStatus });
});
// Handle role-based order actions with escrow simulation
app.post("/api/orders/:id/action", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  let payload;
  try {
    payload = verifyJWT(auth.split(" ")[1]);
  } catch (e) {
    return c.json({ error: "Invalid token" }, 401);
  }

  const { id } = c.req.param();
  const { action } = await c.req.json();

  // fetch current order
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM orders WHERE id = ?"
  ).bind(id).all();

  if (!results || results.length === 0) {
    return c.json({ error: "Order not found" }, 404);
  }

  const order = results[0];
  let newStatus = order.status;
  let escrowLocked = order.escrow_locked;

  // 🛒 Buyer Actions
  if (payload.role === "buyer") {
    if (action === "confirm" && order.status === "delivered") {
      newStatus = "completed";
      escrowLocked = 0; // release escrow to seller
    }
    if (action === "dispute" && order.status === "delivered") {
      newStatus = "disputed";
    }
  }

  // 📦 Seller Actions
  if (payload.role === "seller") {
    if (action === "ship" && order.status === "paid") {
      newStatus = "shipped";
    }
  }

  // 🚚 Logistics Actions
  if (payload.role === "logistics") {
    if (action === "deliver" && order.status === "shipped") {
      newStatus = "delivered";
    }
  }

  // 🛡️ Admin / Support Actions
  if (payload.role === "admin" || payload.role === "support") {
    if (action === "override") {
      newStatus = "overridden";
      escrowLocked = 0; // force release if admin decides
    }
  }

  if (newStatus === order.status) {
    return c.json({ message: "Invalid action for current status" }, 400);
  }

  // update order in DB
  await c.env.DB.prepare(
    "UPDATE orders SET status = ?, escrow_locked = ? WHERE id = ?"
  ).bind(newStatus, escrowLocked, id).run();

  // optional: create a notification entry
  await c.env.DB.prepare(
    "INSERT INTO notifications (user_id, message) VALUES (?, ?)"
  ).bind(order.buyer_id, `Order #${id} status updated to ${newStatus}`).run();

  return c.json({
    message: `Order updated to ${newStatus}`,
    newStatus,
    escrowReleased: escrowLocked === 0
  });
});