-- Ryuzen Anime Hub — Autosave e concorrência otimista para posts
-- Execute uma única vez em bases que já receberam 0000_fresh_blog_schema_reference.sql.
-- Campo aditivo: nenhuma linha existente é apagada, truncada ou recriada.
-- Linhas já existentes recebem version = 1 automaticamente via DEFAULT (SQLite/D1 preenche o valor padrão ao adicionar a coluna).
ALTER TABLE posts ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_posts_updated_at ON posts(updated_at);
