CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id),
  name TEXT NOT NULL,
  category TEXT,
  price REAL NOT NULL,
  stock INTEGER DEFAULT 0,
  image_url TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);