-- Ryuzen Anime Hub — autenticação administrativa segura
-- Execute uma única vez no D1 de produção após a migration do CMS editorial.
-- Esta migration é aditiva e não altera o conteúdo dos posts existentes.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token_hash TEXT NOT NULL UNIQUE,
  csrf_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  user_agent_hash TEXT,
  ip_hash TEXT
);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  attempted_email_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0 CHECK (success IN (0, 1)),
  failure_reason TEXT,
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_login_locks (
  lock_key TEXT PRIMARY KEY,
  locked_until TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_active ON admin_sessions(session_token_hash, expires_at, revoked_at);
CREATE INDEX IF NOT EXISTS idx_admin_attempts_guard ON admin_login_attempts(attempted_email_hash, ip_hash, attempted_at, success);
CREATE INDEX IF NOT EXISTS idx_admin_locks_until ON admin_login_locks(locked_until);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at);
