import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { jwt } from 'hono/jwt'
import { nanoid } from 'nanoid'

// Hono app
const app = new Hono()

// Middleware
app.use('*', cors())

// JWT Secret (should come from env)
const JWT_SECRET = 'super-secret-key'

// Helper to create JWT
const createToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

// --- DATABASE HELPERS ---
async function runQuery(env, query, params = []) {
  return await env.DB.prepare(query).bind(...params).all()
}

async function runExec(env, query, params = []) {
  return await env.DB.prepare(query).bind(...params).run()
}

// --- AUTH ---
app.post('/signup', async (c) => {
  const { name, email, password } = await c.req.json()
  if (!email || !password) return c.json({ error: 'Missing fields' }, 400)

  // hash password (simple for now)
  const passwordHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(password)
  )
  const hashHex = Array.from(new Uint8Array(passwordHash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  try {
    const result = await runExec(
      c.env,
      `INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`,
      [name, email, hashHex]
    )

    // Auto-create subaccount
    await runExec(
      c.env,
      `INSERT INTO subaccounts (user_id, name) VALUES (?, ?)`,
      [result.lastRowId, `${name}-main`]
    )

    return c.json({ message: 'Signup successful' })
  } catch (e) {
    return c.json({ error: 'Email already exists' }, 400)
  }
})

app.post('/login', async (c) => {
  const { email, password } = await c.req.json()
  if (!email || !password) return c.json({ error: 'Missing fields' }, 400)

  const result = await runQuery(
    c.env,
    `SELECT * FROM users WHERE email = ? LIMIT 1`,
    [email]
  )
  if (result.results.length === 0) return c.json({ error: 'User not found' }, 404)

  const user = result.results[0]

  // verify password
  const passwordHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(password)
  )
  const hashHex = Array.from(new Uint8Array(passwordHash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  if (hashHex !== user.password_hash) return c.json({ error: 'Invalid password' }, 401)

  const token = await createToken({ id: user.id, role: user.role })
  return c.json({ token })
})

// --- KYC Verification (Mock: will call Gemini API later) ---
app.post('/kyc/verify', async (c) => {
  const { userId, documentUrl, faceImageUrl } = await c.req.json()

  // Mock: Always success for now
  await runExec(c.env, `UPDATE users SET is_kyc_verified = 1 WHERE id = ?`, [userId])

  return c.json({ message: 'KYC verified successfully' })
})

// --- Marketplace Routes ---
app.post('/products', async (c) => {
  const { userId, name, description, price, quantity } = await c.req.json()

  const user = await runQuery(c.env, `SELECT * FROM users WHERE id = ?`, [userId])
  if (user.results.length === 0) return c.json({ error: 'User not found' }, 404)
  if (user.results[0].is_kyc_verified !== 1)
    return c.json({ error: 'KYC required to list products' }, 403)

  await runExec(
    c.env,
    `INSERT INTO products (user_id, name, description, price, quantity) VALUES (?, ?, ?, ?, ?)`,
    [userId, name, description, price, quantity]
  )

  return c.json({ message: 'Product listed successfully' })
})

app.get('/products', async (c) => {
  const result = await runQuery(c.env, `SELECT * FROM products ORDER BY created_at DESC`)
  return c.json(result.results)
})

// --- Orders & Escrow ---
app.post('/orders', async (c) => {
  const { buyerId, productId, quantity } = await c.req.json()

  const product = await runQuery(c.env, `SELECT * FROM products WHERE id = ?`, [productId])
  if (product.results.length === 0) return c.json({ error: 'Product not found' }, 404)

  const total = product.results[0].price * quantity

  const order = await runExec(
    c.env,
    `INSERT INTO orders (buyer_id, product_id, quantity, total_amount, escrow_locked) VALUES (?, ?, ?, ?, 1)`,
    [buyerId, productId, quantity, total]
  )

  return c.json({ message: 'Order created, funds held in escrow', orderId: order.lastRowId })
})

app.post('/orders/:id/release', async (c) => {
  const id = c.req.param('id')
  await runExec(
    c.env,
    `UPDATE orders SET status = 'released', escrow_locked = 0 WHERE id = ?`,
    [id]
  )
  return c.json({ message: 'Funds released to seller' })
})

app.post('/orders/:id/dispute', async (c) => {
  const id = c.req.param('id')
  await runExec(c.env, `UPDATE orders SET status = 'disputed' WHERE id = ?`, [id])
  return c.json({ message: 'Dispute opened, AI bot + support will assist' })
})

app.get('/', (c) => c.text('🚀 Agribusiness Network API running on Hono'))

export default app// --- ADMIN & SUPPORT PANEL ---
// Middleware to check roles
async function getUserById(env, userId) {
  const res = await runQuery(env, `SELECT * FROM users WHERE id = ?`, [userId])
  return res.results.length > 0 ? res.results[0] : null
}

app.get('/admin/users', async (c) => {
  const { adminId } = c.req.query()
  const user = await getUserById(c.env, adminId)
  if (!user || user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)

  const res = await runQuery(c.env, `SELECT id, name, email, role, is_kyc_verified FROM users`)
  return c.json(res.results)
})

app.get('/admin/orders', async (c) => {
  const { adminId } = c.req.query()
  const user = await getUserById(c.env, adminId)
  if (!user || user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)

  const res = await runQuery(c.env, `SELECT * FROM orders`)
  return c.json(res.results)
})

app.post('/admin/support/add', async (c) => {
  const { adminId, userId } = await c.req.json()
  const user = await getUserById(c.env, adminId)
  if (!user || user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)

  await runExec(c.env, `UPDATE users SET role = 'support' WHERE id = ?`, [userId])
  return c.json({ message: 'User promoted to support team' })
})

app.post('/admin/support/remove', async (c) => {
  const { adminId, userId } = await c.req.json()
  const user = await getUserById(c.env, adminId)
  if (!user || user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403)

  await runExec(c.env, `UPDATE users SET role = 'user' WHERE id = ?`, [userId])
  return c.json({ message: 'Support role removed' })
})

// --- DISPUTE MANAGEMENT ---
app.post('/admin/orders/:id/resolve', async (c) => {
  const id = c.req.param('id')
  const { adminId, action } = await c.req.json() // action: release | refund
  const user = await getUserById(c.env, adminId)
  if (!user || (user.role !== 'admin' && user.role !== 'support')) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  if (action === 'release') {
    await runExec(
      c.env,
      `UPDATE orders SET status = 'released', escrow_locked = 0 WHERE id = ?`,
      [id]
    )
    return c.json({ message: 'Funds released to seller by override' })
  }

  if (action === 'refund') {
    await runExec(
      c.env,
      `UPDATE orders SET status = 'refunded', escrow_locked = 0 WHERE id = ?`,
      [id]
    )
    return c.json({ message: 'Funds refunded to buyer by override' })
  }

  return c.json({ error: 'Invalid action' }, 400)
})