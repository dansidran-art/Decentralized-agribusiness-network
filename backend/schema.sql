-- Disputes (chat thread for each order)
CREATE TABLE IF NOT EXISTS disputes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  evidence TEXT, -- could be image URL or file ref
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
-- Disputes table
CREATE TABLE IF NOT EXISTS disputes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  opened_by INTEGER NOT NULL,
  status TEXT DEFAULT 'open', -- open | resolved | escalated
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (opened_by) REFERENCES users(id)
);

-- Dispute messages (chat)
CREATE TABLE IF NOT EXISTS dispute_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dispute_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  message TEXT,
  image_key TEXT, -- KV image reference
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dispute_id) REFERENCES disputes(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);