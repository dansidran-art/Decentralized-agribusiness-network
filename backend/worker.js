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