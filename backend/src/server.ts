import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import path from 'path';

import { db } from './db';
import type {
  AddLikeBody,
  InterestMap,
  JwtPayload,
  LikedArticleRow,
  LoginBody,
  PutInterestsBody,
  SignupBody,
  UserInterestsRow,
  UserRow,
} from './types';

const PORT = Number(process.env.PORT) || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production-please';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Serve the built frontend from this same folder if present (see README).
app.use(express.static(path.join(__dirname, '..', 'public')));

// ─── Auth middleware ─────────────────────────────────────────
function authRequired(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── Auth routes ─────────────────────────────────────────────

app.post('/api/signup', async (req: Request<unknown, unknown, SignupBody>, res: Response) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required' });
      return;
    }
    if (username.length < 3 || username.length > 32) {
      res.status(400).json({ error: 'Username must be 3–32 characters' });
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      res.status(400).json({ error: 'Username can only contain letters, numbers, _ and -' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as
      | Pick<UserRow, 'id'>
      | undefined;
    if (existing) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    const result = db
      .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
      .run(username, hash);

    const userId = Number(result.lastInsertRowid);

    db.prepare('INSERT INTO user_interests (user_id) VALUES (?)').run(userId);

    const token = jwt.sign({ userId, username } satisfies JwtPayload, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username });
  } catch (err) {
    console.error('signup error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req: Request<unknown, unknown, LoginBody>, res: Response) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password required' });
      return;
    }

    const user = db
      .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
      .get(username) as Pick<UserRow, 'id' | 'username' | 'password_hash'> | undefined;

    if (!user) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    db.prepare('INSERT OR IGNORE INTO user_interests (user_id) VALUES (?)').run(user.id);

    const token = jwt.sign(
      { userId: user.id, username: user.username } satisfies JwtPayload,
      JWT_SECRET,
      { expiresIn: '30d' },
    );
    res.json({ token, username: user.username });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/me', authRequired, (req: Request, res: Response) => {
  res.json({ username: req.username });
});

// ─── Likes routes ────────────────────────────────────────────

app.get('/api/likes', authRequired, (req: Request, res: Response) => {
  const rows = db
    .prepare(
      `SELECT article_id AS id, title, description, extract, image, url, created_at
       FROM liked_articles
       WHERE user_id = ?
       ORDER BY created_at DESC`,
    )
    .all(req.userId) as (Omit<LikedArticleRow, 'article_id' | 'user_id'> & { id: number })[];
  res.json({ likes: rows });
});

app.post('/api/likes', authRequired, (req: Request<unknown, unknown, AddLikeBody>, res: Response) => {
  const { id, title, description, extract, image, url } = req.body || {};
  if (!id || !title) {
    res.status(400).json({ error: 'id and title required' });
    return;
  }

  try {
    db.prepare(
      `INSERT OR IGNORE INTO liked_articles
        (user_id, article_id, title, description, extract, image, url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(req.userId, id, title, description || '', extract || '', image || '', url || '');
    res.json({ ok: true });
  } catch (err) {
    console.error('like error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/likes/:articleId', authRequired, (req: Request<{ articleId: string }>, res: Response) => {
  const articleId = parseInt(req.params.articleId, 10);
  if (!Number.isFinite(articleId)) {
    res.status(400).json({ error: 'Bad article id' });
    return;
  }

  db.prepare('DELETE FROM liked_articles WHERE user_id = ? AND article_id = ?').run(req.userId, articleId);
  res.json({ ok: true });
});

// ─── Interest profile routes ─────────────────────────────────

app.get('/api/interests', authRequired, (req: Request, res: Response) => {
  const row = db
    .prepare('SELECT interests, liked_titles, seen_ids, clicked_ids FROM user_interests WHERE user_id = ?')
    .get(req.userId) as Pick<UserInterestsRow, 'interests' | 'liked_titles' | 'seen_ids' | 'clicked_ids'> | undefined;

  if (!row) {
    res.json({ interests: {}, likedTitles: [], seenIds: [], clickedIds: [] });
    return;
  }

  res.json({
    interests: JSON.parse(row.interests) as InterestMap,
    likedTitles: JSON.parse(row.liked_titles) as string[],
    seenIds: JSON.parse(row.seen_ids) as number[],
    clickedIds: JSON.parse(row.clicked_ids) as number[],
  });
});

app.put('/api/interests', authRequired, (req: Request<unknown, unknown, PutInterestsBody>, res: Response) => {
  const { interests, likedTitles, seenIds, clickedIds } = req.body || {};

  const cappedSeen = Array.isArray(seenIds) ? seenIds.slice(-1000) : [];
  const cappedClicked = Array.isArray(clickedIds) ? clickedIds.slice(-500) : [];
  const cappedTitles = Array.isArray(likedTitles) ? likedTitles.slice(-500) : [];

  db.prepare(
    `INSERT INTO user_interests (user_id, interests, liked_titles, seen_ids, clicked_ids, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       interests    = excluded.interests,
       liked_titles = excluded.liked_titles,
       seen_ids     = excluded.seen_ids,
       clicked_ids  = excluded.clicked_ids,
       updated_at   = CURRENT_TIMESTAMP`,
  ).run(
    req.userId,
    JSON.stringify(interests || {}),
    JSON.stringify(cappedTitles),
    JSON.stringify(cappedSeen),
    JSON.stringify(cappedClicked),
  );

  res.json({ ok: true });
});

// ─── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}`);
});
