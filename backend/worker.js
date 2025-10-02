import { Hono } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { users, products, orders, disputes, disputeMessages } from "./schema.js";

const app = new Hono();
app.use("*", cors());

// Helper: get DB
const getDB = c => drizzle(c.env.DB);

// ------------------ USERS ------------------
app.post("/api/signup", async c => {
  const { name, email, password } = await c.req.json();
  const db = getDB(c);
  await db.insert(users).values({ name, email, password_hash: password });
  return c.json({ message: "User created" });
});

app.post("/api/login", async c => {
  const { email, password } = await c.req.json();
  const db = getDB(c);
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || user.password_hash !== password) {
    return c.json({ error: "Invalid credentials" }, 401);
  }
  return c.json({ message: "Login successful", user });
});

// ------------------ PRODUCTS ------------------
app.post("/api/products", async c => {
  const { user_id, name, description, price, quantity } = await c.req.json();
  const db = getDB(c);
  await db.insert(products).values({ user_id, name, description, price, quantity });
  return c.json({ message: "Product listed" });
});

app.get("/api/products", async c => {
  const db = getDB(c);
  const list = await db.select().from(products);
  return c.json(list);
});

// ------------------ ORDERS ------------------
app.post("/api/orders", async c => {
  const { buyer_id, product_id, quantity } = await c.req.json();
  const db = getDB(c);
  const product = await db.query.products.findFirst({ where: eq(products.id, product_id) });
  if (!product) return c.json({ error: "Product not found" }, 404);

  const total = product.price * quantity;
  await db.insert(orders).values({
    buyer_id,
    product_id,
    quantity,
    total_amount: total,
    status: "created",
    escrow_locked: 0,
  });

  return c.json({ message: "Order created. Awaiting payment" });
});

// List orders
app.get("/api/orders", async c => {
  const db = getDB(c);
  const list = await db.select().from(orders);
  return c.json({ orders: list });
});

// Handle actions (buyer/seller/logistics)
app.post("/api/orders/:id/action", async c => {
  const { action } = await c.req.json();
  const orderId = parseInt(c.req.param("id"));
  const db = getDB(c);

  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) return c.json({ error: "Order not found" }, 404);

  let statusUpdate = null;

  switch (action) {
    case "pay":
      statusUpdate = "paid";
      break;
    case "ship":
      statusUpdate = "shipped";
      break;
    case "deliver":
      statusUpdate = "delivered";
      break;
    case "confirm_delivery":
      statusUpdate = "released"; // escrow funds released
      break;
    case "dispute":
      statusUpdate = "disputed";
      await db.insert(disputes).values({ order_id: orderId, status: "open" });
      break;
    default:
      return c.json({ error: "Invalid action" }, 400);
  }

  await db.update(orders).set({ status: statusUpdate }).where(eq(orders.id, orderId));
  return c.json({ message: `Order updated: ${statusUpdate}` });
});

// ------------------ DISPUTE CHAT ------------------
// Get messages
app.get("/api/disputes/:orderId", async c => {
  const db = getDB(c);
  const msgs = await db
    .select()
    .from(disputeMessages)
    .where(eq(disputeMessages.order_id, parseInt(c.req.param("orderId"))));
  return c.json({ messages: msgs });
});

// Post message
app.post("/api/disputes/:orderId", async c => {
  const { user_id, message, image_url } = await c.req.json();
  const orderId = parseInt(c.req.param("orderId"));
  const db = getDB(c);

  await db.insert(disputeMessages).values({
    order_id: orderId,
    user_id,
    message,
    image_url,
  });

  return c.json({ message: "Message sent" });
});

export default app;