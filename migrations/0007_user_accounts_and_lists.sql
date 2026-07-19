-- Ryuzen Anime Hub — Contas de usuário público + lista de animes
-- ATENÇÃO: este arquivo NÃO é para o banco BLOG_DB (blog/admin/loja).
-- Execute em um banco D1 novo e dedicado (ex.: "ryuzen-users-db"),
-- bindado no Cloudflare Pages com a variável USERS_DB.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  csrf_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  user_agent_hash TEXT,
  ip_hash TEXT
);

CREATE TABLE IF NOT EXISTS user_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempted_email_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0 CHECK (success IN (0, 1)),
  failure_reason TEXT,
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_login_locks (
  lock_key TEXT PRIMARY KEY,
  locked_until TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS anime_list_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anime_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  image TEXT,
  status TEXT NOT NULL DEFAULT 'plan' CHECK (status IN ('plan', 'watching', 'completed', 'paused', 'dropped', 'favorite')),
  personal_score REAL,
  episodes_watched INTEGER NOT NULL DEFAULT 0,
  total_episodes INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, anime_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(session_token_hash, expires_at, revoked_at);
CREATE INDEX IF NOT EXISTS idx_user_attempts_guard ON user_login_attempts(attempted_email_hash, ip_hash, attempted_at, success);
CREATE INDEX IF NOT EXISTS idx_user_locks_until ON user_login_locks(locked_until);
CREATE INDEX IF NOT EXISTS idx_anime_list_user ON anime_list_items(user_id, status);
