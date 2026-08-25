# Scrollopedia (TypeScript + React)

A TikTok-style, infinite-scroll Wikipedia explorer with a lightweight
recommendation engine, converted from a single-file HTML/vanilla-JS app +
Express/JS backend into a typed React app and a typed Express API.

```
scrollopedia/
├── frontend/   Vite + React + TypeScript SPA
└── backend/    Express + TypeScript + SQLite API (auth, likes, interest sync)
```

## Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

- `src/lib/recommend.ts` — the `RecommendationEngine` class (keyword
  extraction, interest scoring, decay), ported from the original `recommend`
  object.
- `src/lib/wikipedia.ts` — Wikipedia REST/Action API calls (random article,
  search, linked articles, image attribution) and `loadSmartArticles`, the
  batch loader that mixes related + discovery content.
- `src/lib/storage.ts` — localStorage persistence (works with no backend at
  all, exactly like the original app).
- `src/lib/api.ts` — thin client for the backend's `/api/*` routes (auth,
  likes, interests), used only when the person signs in.
- `src/App.tsx` — top-level state: the article list, current index, like
  set, buffering, and keyboard/wheel/touch navigation.
- `src/components/` — `Header`, `Card`, `LikesPanel`, `NavHints`, `AuthModal`.

The app works fully offline of the backend (everything persists to
`localStorage`, as in the original). Signing in via the account button syncs
likes and the interest profile to the backend so they follow the person
across devices.

In dev, Vite proxies `/api/*` to `http://localhost:3001` (see
`vite.config.ts`), so run the backend alongside the frontend.

## Backend

```bash
cd backend
npm install
npm run dev       
# or
npm run build && npm start
```

Routes (unchanged from the original `server.js`, just typed):

- `POST /api/signup`, `POST /api/login`, `GET /api/me`
- `GET /api/likes`, `POST /api/likes`, `DELETE /api/likes/:articleId`
- `GET /api/interests`, `PUT /api/interests`

Set `JWT_SECRET` and `DB_PATH` env vars in production; `JWT_SECRET` defaults
to a placeholder that must be overridden outside local dev.

## Building for production

```bash
cd frontend && npm run build   # outputs frontend/dist
```

Copy `frontend/dist` into `backend/public` (the server already serves static
files from there) or host the frontend separately and point it at the
backend's URL.
