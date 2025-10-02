// backend/worker.js
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt } from 'hono/jwt'

const app = new Hono()
app.use('*', cors())

// --- AUTH HELPERS ---
const generateJWT = (user, secret) =>
  new Response(JSON.stringify({
    token: jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn: '7d' })
  }), { headers: { 'Content-Type': 'application/json' } })

// --- AUTH ROUTES ---
app.post('/signup', async c => {
  const { name, email, password } = await c.req.json()
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  await c.env.DB.prepare(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
  ).bind(name, email, btoa(String.fromCharCode(...new Uint8Array(hash)))).run()
  return c.json({ success: true })
})

app.post('/login', async c => {
  const { email, password } = await c.req.json()
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first()
  if (!user) return c.json({ error: 'Invalid credentials' }, 401)

  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  if (user.password_hash !== btoa(String.fromCharCode(...new Uint8Array(hash)))) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }
  return generateJWT(user, c.env.JWT_SECRET)
})

// --- KYC ROUTE (Gemini AI) ---
app.post('/kyc', async c => {
  const { userId, documentImage, selfieImage } = await c.req.json()

  // Call Gemini AI (mock for now)
  const isValid = documentImage && selfieImage // you’ll wire real API later

  if (isValid) {
    await c.env.DB.prepare(
      'UPDATE users SET is_kyc_verified = 1 WHERE id = ?'
    ).bind(userId).run()

    // Auto-create subaccount
    await c.env.DB.prepare(
      'INSERT INTO subaccounts (user_id, name) VALUES (?, ?)'
    ).bind(userId, 'Primary Wallet').run()

    return c.json({ verified: true })
  }
  return c.json({ verified: false })
})

// --- MARKETPLACE ROUTES ---
app.post('/products', async c => {
  const { userId, name, description, price, quantity } = await c.req.json()
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first()
  if (!user || !user.is_kyc_verified) return c.json({ error: 'KYC required' }, 403)

  await c.env.DB.prepare(
    'INSERT INTO products (user_id, name, description, price, quantity) VALUES (?, ?, ?, ?, ?)'
  ).bind(userId, name, description, price, quantity).run()
  return c.json({ success: true })
})

app.get('/products', async c => {
  const products = await c.env.DB.prepare('SELECT * FROM products').all()
  return c.json(products.results)
})

// --- ORDERS & ESCROW ---
app.post('/orders', async c => {
  const { buyerId, productId, quantity } = await c.req.json()
  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first()
  if (!product) return c.json({ error: 'Product not found' }, 404)

  const total = product.price * quantity
  await c.env.DB.prepare(
    'INSERT INTO orders (buyer_id, product_id, quantity, total_amount, status, escrow_locked) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(buyerId, productId, quantity, total, 'paid', 1).run()
  return c.json({ success: true, escrow_locked: true })
})

app.post('/orders/:id/confirm', async c => {
  const id = c.req.param('id')
  await c.env.DB.prepare(
    "UPDATE orders SET status = 'delivered', escrow_locked = 0 WHERE id = ?"
  ).bind(id).run()
  return c.json({ released: true })
})

app.post('/orders/:id/dispute', async c => {
  const id = c.req.param('id')
  await c.env.DB.prepare(
    "UPDATE orders SET status = 'disputed' WHERE id = ?"
  ).bind(id).run()
  return c.json({ disputed: true })
})

// --- ADMIN & SUPPORT PANEL ---
app.get('/admin/users', async c => {
  const users = await c.env.DB.prepare('SELECT id, name, email, role, is_kyc_verified FROM users').all()
  return c.json(users.results)
})

app.post('/admin/users/:id/role', async c => {
  const id = c.req.param('id')
  const { role } = await c.req.json()
  await c.env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id).run()
  return c.json({ updated: true })
})

app.post('/admin/orders/:id/override', async c => {
  const id = c.req.param('id')
  const { status } = await c.req.json()
  await c.env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind(status, id).run()
  return c.json({ overridden: true })
})

// --- DISPUTE CHAT (AI + File Upload) ---
app.post('/disputes/:id/chat', async c => {
  const id = c.req.param('id')
  const { userId, message } = await c.req.json()

  // Save chat in notifications table
  await c.env.DB.prepare(
    'INSERT INTO notifications (user_id, message) VALUES (?, ?)'
  ).bind(userId, `[DISPUTE ${id}] ${message}`).run()

  // AI suggestion (mocked, hook Gemini API later)
  const aiReply = "AI Assistant: We suggest both parties upload delivery proof."

  return c.json({ success: true, ai: aiReply })
})

export default app