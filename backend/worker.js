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