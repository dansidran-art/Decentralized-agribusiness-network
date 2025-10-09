CREATE TABLE IF NOT EXISTS farms (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  size_acres REAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);