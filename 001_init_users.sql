CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'farmer', -- e.g. farmer, buyer, admin
  location TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);