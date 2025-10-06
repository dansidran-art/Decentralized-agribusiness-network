import { Hono } from "hono";
import { cors } from "hono/cors";
import { v4 as uuidv4 } from "uuid";

const app = new Hono();
app.use("*", cors());

// ✅ Helper: simulate Gemini AI verification
async function verifyWithGemini(documentImage, selfieImage) {
  // In production, call Gemini Vision API here with your API key
  console.log("Simulating Gemini verification...");
  return documentImage && selfieImage ? true : false;
}

// ✅ Create subaccount after KYC
app.post("/api/create-subaccount", async (c) => {
  try {
    const { userId } = await c.req.json();
    const subId = uuidv4();
    const accountNumber = `AGRI-${Math.floor(100000 + Math.random() * 900000)}`;

    await c.env.DB.prepare(
      "INSERT INTO subaccounts (user_id, name) VALUES (?, ?)"
    ).bind(userId, `Sub-${accountNumber}`).run();

    await c.env.DB.prepare(
      "UPDATE users SET subaccount_id = ?, account_number = ? WHERE id = ?"
    ).bind(subId, accountNumber, userId).run();

    return c.json({ success: true, subId, accountNumber });
  } catch (err) {
    return c.json({ success: false, error: err.message });
  }
});

// ✅ KYC verification route
app.post("/api/kyc/upload", async (c) => {
  try {
    const { userId, documentImage, selfieImage } = await c.req.json();

    // Gemini Vision check
    const isVerified = await verifyWithGemini(documentImage, selfieImage);

    if (isVerified) {
      await c.env.DB.prepare(
        "UPDATE users SET is_kyc_verified = 1 WHERE id = ?"
      ).bind(userId).run();

      // Automatically create subaccount
      await fetch(`${c.env.APP_URL}/api/create-subaccount`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
    }

    return c.json({ success: isVerified });
  } catch (err) {
    return c.json({ success: false, error: "KYC verification failed" });
  }
});

// ✅ Withdrawal simulation (Gemini recheck + escrow release)
app.post("/api/withdraw", async (c) => {
  try {
    const { userId, amount } = await c.req.json();

    const user = await c.env.DB.prepare(
      "SELECT * FROM users WHERE id = ?"
    ).bind(userId).first();

    if (!user || !user.is_kyc_verified) {
      return c.json({ success: false, error: "User not verified for withdrawal" });
    }

    // Simulate Gemini validation (e.g., selfie match, liveness)
    const verified = await verifyWithGemini("simulated-id", "simulated-face");
    if (!verified) {
      return c.json({ success: false, error: "Gemini AI denied withdrawal" });
    }

    // Mock withdrawal success
    console.log(`✅ Withdraw ${amount} for user ${userId}`);
    return c.json({ success: true, message: "Withdrawal approved" });
  } catch (err) {
    return c.json({ success: false, error: err.message });
  }
});

// ✅ Default root route
app.get("/", (c) => c.text("AgriNetwork Backend API Running ✅"));

export default app;
// --- ORDER ACTION HANDLER ---
app.post("/api/orders/:id/action", async (c) => {
  const orderId = c.req.param("id");
  const { action, userId } = await c.req.json();

  const db = c.env.DB;

  // Fetch current order info
  const order = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(orderId).first();
  if (!order) return c.json({ error: "Order not found" }, 404);

  let newStatus = order.status;
  let message = "";

  switch (action) {
    case "ship":
      newStatus = "shipped";
      message = "Shipment confirmed by seller.";
      break;

    case "deliver":
      newStatus = "delivered";
      message = "Delivery confirmed by logistics.";
      break;

    case "release":
      newStatus = "completed";
      message = "Buyer confirmed receipt, funds released.";
      // simulate fund release to seller subaccount
      await db
        .prepare("UPDATE wallets SET balance = balance + ? WHERE user_id = ?")
        .bind(order.total_amount, order.seller_id)
        .run();
      break;

    case "dispute":
      newStatus = "dispute";
      message = "Dispute opened. Admin & AI assistant will review.";
      break;

    default:
      return c.json({ error: "Invalid action" }, 400);
  }

  await db.prepare("UPDATE orders SET status = ? WHERE id = ?").bind(newStatus, orderId).run();

  return c.json({ message, status: newStatus });
});

// --- ORDER CHAT HANDLER ---
app.get("/api/chat/:orderId", async (c) => {
  const orderId = c.req.param("orderId");
  const db = c.env.DB;

  const chats = await db.prepare("SELECT * FROM order_chats WHERE order_id = ? ORDER BY created_at ASC").bind(orderId).all();

  return c.json(chats.results || []);
});

app.post("/api/chat/:orderId", async (c) => {
  const orderId = c.req.param("orderId");
  const formData = await c.req.formData();

  const userId = formData.get("userId");
  const message = formData.get("message") || "";
  const file = formData.get("file");

  const db = c.env.DB;

  // simulate file upload (you can replace with R2 or Cloudflare Images)
  let imageUrl = null;
  if (file) {
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    imageUrl = `data:${file.type};base64,${base64}`;
  }

  await db
    .prepare("INSERT INTO order_chats (order_id, user_id, message, image) VALUES (?, ?, ?, ?)")
    .bind(orderId, userId, message, imageUrl)
    .run();

  // Send to AI dispute assistant
  const aiResponse = await handleAIResponse(c, orderId, message);

  return c.json({
    sender: "user",
    user_id: userId,
    message,
    image: imageUrl,
    ai_response: aiResponse,
  });
});

// --- GEMINI AI DISPUTE ASSISTANT (SIMULATION) ---
async function handleAIResponse(c, orderId, userMessage) {
  const prompt = `
You are an AI dispute resolver for an agribusiness marketplace.
User message: "${userMessage}"
Your job: respond in a helpful and fair way. Keep replies short (2-3 sentences).
`;

  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + c.env.GEMINI_API_KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const data = await res.json();
    const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "AI assistant is reviewing this case.";

    // save AI reply in chat
    await c.env.DB
      .prepare("INSERT INTO order_chats (order_id, user_id, sender, message) VALUES (?, ?, ?, ?)")
      .bind(orderId, "ai", "ai", aiText)
      .run();

    return aiText;
  } catch (err) {
    console.error("AI error:", err);
    return "AI assistant unavailable. Please wait for admin review.";
  }
}