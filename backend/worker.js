import { Hono } from "hono";
import { cors } from "hono/cors";
import { jwt } from "hono/jwt";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = new Hono();

// Middleware
app.use("*", cors());

// --- ENV SETUP ---
const getEnv = (c) => ({
  db: c.env.DB, // Cloudflare D1
  genAI: new GoogleGenerativeAI(c.env.GEMINI_API_KEY),
});

// --- Signup ---
app.post("/signup", async (c) => {
  const { name, email, password } = await c.req.json();
  await c.env.DB.prepare(
    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
  ).bind(name, email, password).run();
  return c.json({ success: true });
});

// --- Login (simple demo JWT) ---
app.post("/login", async (c) => {
  const { email, password } = await c.req.json();
  const user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE email = ? AND password_hash = ?"
  ).bind(email, password).first();
  if (!user) return c.json({ error: "Invalid credentials" }, 401);

  // For demo: return role directly
  return c.json({ token: "demo-token", role: user.role, is_kyc_verified: user.is_kyc_verified });
});

// --- Products ---
app.get("/products", async (c) => {
  const rows = await c.env.DB.prepare("SELECT * FROM products").all();
  return c.json(rows.results);
});

app.post("/products", async (c) => {
  const { userId, name, description, price, quantity } = await c.req.json();
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
  if (!user || !user.is_kyc_verified) {
    return c.json({ error: "KYC required to list products" }, 403);
  }
  await c.env.DB.prepare(
    "INSERT INTO products (user_id, name, description, price, quantity) VALUES (?, ?, ?, ?, ?)"
  ).bind(userId, name, description, price, quantity).run();
  return c.json({ success: true });
});

// --- Orders ---
app.get("/orders", async (c) => {
  const rows = await c.env.DB.prepare("SELECT * FROM orders").all();
  return c.json(rows.results);
});

app.post("/orders", async (c) => {
  const { buyerId, productId, quantity } = await c.req.json();
  const product = await c.env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(productId).first();
  if (!product) return c.json({ error: "Product not found" }, 404);

  const total = product.price * quantity;
  await c.env.DB.prepare(
    "INSERT INTO orders (buyer_id, product_id, quantity, total_amount) VALUES (?, ?, ?, ?)"
  ).bind(buyerId, productId, quantity, total).run();

  return c.json({ success: true });
});

// --- KYC (Google Gemini Verification Simulation) ---
app.post("/kyc", async (c) => {
  const { userId, documentImage, selfieImage } = await c.req.json();
  const { genAI } = getEnv(c);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // AI verifies document & face
  const prompt = `Verify if the provided ID document and selfie belong to the same person. 
  Document: ${documentImage}, Selfie: ${selfieImage}`;

  const result = await model.generateContent(prompt);
  const verified = result.response.text().toLowerCase().includes("yes");

  await c.env.DB.prepare("UPDATE users SET is_kyc_verified = ? WHERE id = ?")
    .bind(verified ? 1 : 0, userId).run();

  return c.json({ verified });
});

// --- Disputes with AI Chat ---
app.post("/disputes", async (c) => {
  const { orderId, message, evidence } = await c.req.json();
  const { genAI } = getEnv(c);

  // Save message in DB
  await c.env.DB.prepare(
    "INSERT INTO notifications (user_id, message) VALUES (?, ?)"
  ).bind(1, `Dispute on order ${orderId}: ${message} ${evidence ? `[evidence: ${evidence}]` : ""}`).run();

  // Ask Gemini AI for guidance
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `Dispute for order ${orderId}: "${message}". 
  Evidence: ${evidence || "none"}. 
  Give a helpful response as a dispute mediator.`;

  const result = await model.generateContent(prompt);
  const reply = result.response.text();

  return c.json({ reply });
});

// --- Admin: View Users ---
app.get("/admin/users", async (c) => {
  const rows = await c.env.DB.prepare("SELECT id, email, role, is_kyc_verified FROM users").all();
  return c.json(rows.results);
});

export default app;
// --- Disputes with AI Chat ---
app.post("/disputes", async (c) => {
  const { orderId, userId, message, evidence } = await c.req.json();
  const { genAI } = getEnv(c);

  // Save chat message in disputes table
  await c.env.DB.prepare(
    "INSERT INTO disputes (order_id, user_id, message, evidence) VALUES (?, ?, ?, ?)"
  ).bind(orderId, userId, message, evidence || null).run();

  // Ask Gemini AI for mediation help
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `Dispute on order ${orderId}. 
User ${userId} says: "${message}". 
Evidence: ${evidence || "none"}. 
You are an AI mediator for an agribusiness marketplace. 
Provide a helpful, neutral response.`;

  const result = await model.generateContent(prompt);
  const reply = result.response.text();

  // Save AI reply also in DB
  await c.env.DB.prepare(
    "INSERT INTO disputes (order_id, user_id, message) VALUES (?, ?, ?)"
  ).bind(orderId, 0, reply) // user_id=0 means AI/system
    .run();

  return c.json({ reply });
});

// Fetch dispute chat for an order
app.get("/disputes/:orderId", async (c) => {
  const orderId = c.req.param("orderId");
  const rows = await c.env.DB.prepare(
    "SELECT * FROM disputes WHERE order_id = ? ORDER BY created_at ASC"
  ).bind(orderId).all();
  return c.json(rows.results);
});