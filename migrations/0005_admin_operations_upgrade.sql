-- Ryuzen Anime Hub — Admin Operations Upgrade
-- Execute uma única vez em bases que já receberam 0004_store_ryuzen.sql.
-- Campo aditivo para revisão manual de links afiliados; nenhum dado é apagado.
ALTER TABLE store_products ADD COLUMN link_review_status TEXT NOT NULL DEFAULT 'not_reviewed'
  CHECK (link_review_status IN ('not_reviewed','reviewed','needs_check'));
CREATE INDEX IF NOT EXISTS idx_store_products_order ON store_products(sort_order, id);
CREATE INDEX IF NOT EXISTS idx_store_products_link_review ON store_products(status, link_review_status, last_reviewed_at);
