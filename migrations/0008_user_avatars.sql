-- Ryuzen Anime Hub — avatar de perfil (galeria fixa curada pelo time)
-- ATENÇÃO: este arquivo é para o banco de contas públicas (USERS_DB / ryuzen-users-db),
-- não para o BLOG_DB. Execute após 0007_user_accounts_and_lists.sql.
-- Aditiva: nenhuma linha existente é apagada ou truncada.
ALTER TABLE users ADD COLUMN avatar_filename TEXT;
