import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'scrollopedia.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS liked_articles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    article_id  INTEGER NOT NULL,
    title       TEXT NOT NULL,
    description TEXT,
    extract     TEXT,
    image       TEXT,
    url         TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, article_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_interests (
    user_id      INTEGER PRIMARY KEY,
    interests    TEXT NOT NULL DEFAULT '{}',
    liked_titles TEXT NOT NULL DEFAULT '[]',
    seen_ids     TEXT NOT NULL DEFAULT '[]',
    clicked_ids  TEXT NOT NULL DEFAULT '[]',
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_likes_user ON liked_articles(user_id, created_at DESC);
`);

console.log(`[db] ready at ${DB_PATH}`);
