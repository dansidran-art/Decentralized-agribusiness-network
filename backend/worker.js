// --- ADMIN & SUPPORT PANEL ---
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