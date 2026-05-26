-- Ryuzen Anime Hub — Loja Ryuzen afiliada Amazon
-- Migration aditiva: produtos, banner da home e cliques agregáveis sem dados pessoais.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS store_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('manga','light_novel','collectible','digital_reading','geek_gift','apparel','creators','other')),
  description TEXT NOT NULL,
  affiliate_url TEXT NOT NULL,
  asin TEXT NOT NULL DEFAULT '',
  related_title TEXT NOT NULL DEFAULT '',
  badge TEXT NOT NULL DEFAULT 'none' CHECK (badge IN ('none','ryuzen_choice','getting_started','highlight','recommended','geek_gift')),
  image_url TEXT NOT NULL,
  image_alt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 100,
  internal_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_reviewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_store_products_public ON store_products(status, sort_order, updated_at);
CREATE INDEX IF NOT EXISTS idx_store_products_category ON store_products(category, status);

CREATE TABLE IF NOT EXISTS store_home_banner (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  eyebrow TEXT NOT NULL DEFAULT 'LOJA RYUZEN · SELEÇÃO DA SEMANA',
  title TEXT NOT NULL DEFAULT 'Achados para quem vive o mundo anime',
  description TEXT NOT NULL DEFAULT 'Mangás, light novels e produtos selecionados pela Ryuzen para fãs de anime.',
  button_text TEXT NOT NULL DEFAULT 'Explorar a Loja',
  button_url TEXT NOT NULL DEFAULT '/loja/',
  image_url TEXT NOT NULL DEFAULT '',
  image_alt TEXT NOT NULL DEFAULT '',
  affiliate_disclaimer TEXT NOT NULL DEFAULT 'Links afiliados. Compras e condições são processadas pela Amazon.',
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','archived')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO store_home_banner (id) VALUES (1);

CREATE TABLE IF NOT EXISTS store_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  destination_type TEXT NOT NULL CHECK (destination_type IN ('home_banner','store_product')),
  product_id INTEGER,
  source TEXT NOT NULL CHECK (source IN ('home','loja')),
  clicked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES store_products(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_store_clicks_type_date ON store_clicks(destination_type, clicked_at);
CREATE INDEX IF NOT EXISTS idx_store_clicks_product ON store_clicks(product_id, clicked_at);
