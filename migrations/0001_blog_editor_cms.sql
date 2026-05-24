-- Execute UMA VEZ no Console do banco D1 ryuzen-anime-hub-prod.
-- Antes de executar, confirme via PRAGMA table_info('posts') que as colunas ainda não existem.
ALTER TABLE posts ADD COLUMN content_html TEXT;
ALTER TABLE posts ADD COLUMN social_image_url TEXT;
