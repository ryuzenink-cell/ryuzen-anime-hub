-- Ryuzen Anime Hub — Central Administrativa: banners promocionais
-- Execute uma única vez no D1 de produção. Migration aditiva e não destrutiva.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  placement TEXT NOT NULL CHECK (placement IN ('blog_sidebar_left','blog_sidebar_right','blog_inline_horizontal','blog_home_featured')),
  image_url TEXT NOT NULL,
  alt_text TEXT NOT NULL,
  target_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_banners_placement_status ON banners(placement, status);
CREATE INDEX IF NOT EXISTS idx_banners_updated_at ON banners(updated_at);
