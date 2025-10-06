import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { v4 as uuidv4 } from 'uuid';

const app = new Hono();
app.use('*', cors());

/* ============================================================
   🧩 Utility Functions (Simulated AI + Helpers)
============================================================ */
async function simulateGeminiKYCVerification(idNumber, name) {
  await new Promise(r => setTimeout(r, 500));
  return idNumber && name ? { verified: true, confidence: 0.98 } : { verified: false };
}

async function simulateGeminiDisputeResolution(context) {
  await new Promise(r => setTimeout(r, 800));
  return { result: 'resolved_in_favor_of_buyer', confidence: 0.93 };
}

function generateSubAccount(userId) {
  return `SUB-${userId}-${Math.floor(Math.random() * 999999)}`;
}

/* ============================================================
   🧱 Database setup
============================================================ */
async function ensureTables(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      password TEXT,
      role TEXT DEFAULT 'user',
      is_kyc_verified INTEGER DEFAULT 0,
      sub_account TEXT
    );`),
    db.prepare(`CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      price REAL,
      owner_id TEXT,
      created_at TEXT
    );`),
    db.prepare(`CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      buyer_id TEXT,
      product_id TEXT,
      total_amount REAL,
      status TEXT,
      created_at TEXT
    );`),
    db.prepare(`CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      sender TEXT,
      text TEXT,
      ts TEXT
    );`)
  ]);
}

/* ============================================================
   👥 User Signup / Login / KYC
============================================================ */
app.post('/api/signup', async (c) => {
  const { name, email, password } = await c.req.json();
  const id = uuidv4();
  const subAcc = generateSubAccount(id);
  await ensureTables(c.env.DB);
  await c.env.DB.prepare(
    'INSERT INTO users (id, name, email, password, sub_account) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, name, email, password, subAcc).run();
  return c.json({ id, name, email, sub_account: subAcc });
});

app.post('/api/login', async (c) => {
  const { email, password } = await c.req.json();
  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ? AND password = ?'
  ).bind(email, password).first();
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);
  return c.json(user);
});

app.post('/api/kyc', async (c) => {
  const { userId, idNumber, fullName } = await c.req.json();
  const result = await simulateGeminiKYCVerification(idNumber, fullName);
  if (result.verified) {
    await c.env.DB.prepare('UPDATE users SET is_kyc_verified = 1 WHERE id = ?').bind(userId).run();
  }
  return c.json(result);
});

/* ============================================================
   💰 Withdraw (Simulated AI verification)
============================================================ */
app.post('/api/withdraw', async (c) => {
  const { userId, amount } = await c.req.json();
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!user || !user.is_kyc_verified) {
    return c.json({ error: 'KYC not verified' }, 400);
  }
  await new Promise(r => setTimeout(r, 700));
  return c.json({ status: 'success', tx_ref: uuidv4(), amount });
});

/* ============================================================
   🛒 Marketplace (Products)
============================================================ */
app.get('/api/products', async (c) => {
  await ensureTables(c.env.DB);
  const { results } = await c.env.DB.prepare('SELECT * FROM products').all();
  return c.json(results);
});

app.post('/api/products', async (c) => {
  const { title, description, price, owner_id } = await c.req.json();
  const id = uuidv4();
  await ensureTables(c.env.DB);
  await c.env.DB.prepare(
    'INSERT INTO products (id, title, description, price, owner_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, title, description, price, owner_id, new Date().toISOString()).run();
  return c.json({ id, message: 'Product created' });
});

/* ============================================================
   💸 Orders / Escrow Flow
============================================================ */
app.post('/api/orders', async (c) => {
  const { buyer_id, product_id, total_amount } = await c.req.json();
  const id = uuidv4();
  await c.env.DB.prepare(
    'INSERT INTO orders (id, buyer_id, product_id, total_amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, buyer_id, product_id, total_amount, 'payment_held_in_escrow', new Date().toISOString()).run();
  return c.json({ id, message: 'Order placed & funds held in escrow' });
});

app.get('/api/orders/:buyer_id', async (c) => {
  const buyer_id = c.req.param('buyer_id');
  const { results } = await c.env.DB.prepare('SELECT * FROM orders WHERE buyer_id = ?').bind(buyer_id).all();
  return c.json(results);
});

app.post('/api/orders/release', async (c) => {
  const { order_id } = await c.req.json();
  await c.env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind('released_to_seller', order_id).run();
  return c.json({ status: 'released' });
});

app.post('/api/orders/dispute', async (c) => {
  const { order_id, context } = await c.req.json();
  const decision = await simulateGeminiDisputeResolution(context);
  await c.env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?')
    .bind(decision.result, order_id)
    .run();
  return c.json(decision);
});

/* ============================================================
   💬 Messaging / Dispute Chat
============================================================ */
app.get('/api/messages/:order_id', async (c) => {
  const order_id = c.req.param('order_id');
  const { results } = await c.env.DB.prepare('SELECT * FROM messages WHERE order_id = ? ORDER BY ts ASC').bind(order_id).all();
  return c.json(results);
});

app.post('/api/messages', async (c) => {
  const { order_id, sender, text } = await c.req.json();
  const id = uuidv4();
  await c.env.DB.prepare('INSERT INTO messages (id, order_id, sender, text, ts) VALUES (?, ?, ?, ?, ?)')
    .bind(id, order_id, sender, text, new Date().toISOString())
    .run();
  return c.json({ id, status: 'sent' });
});

/* ============================================================
   🧑‍💼 Admin Routes
============================================================ */
app.get('/api/admin/users', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM users').all();
  return c.json(results);
});

app.get('/api/admin/orders', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM orders').all();
  return c.json(results);
});

app.delete('/api/admin/user/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return c.json({ message: 'User removed' });
});

export default app;