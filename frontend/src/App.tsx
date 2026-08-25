import { useCallback, useEffect, useRef, useState } from 'react';
import Header from './components/Header';
import LikesPanel from './components/LikesPanel';
import NavHints from './components/NavHints';
import Card from './components/Card';
import AuthModal from './components/AuthModal';
import { RecommendationEngine } from './lib/recommend';
import { loadFromLocalStorage, saveToLocalStorage } from './lib/storage';
import { enrichAttributions, loadSmartArticles } from './lib/wikipedia';
import { authApi, clearSession, getToken, getUsername, likesApi, interestsApi, setSession } from './lib/api';
import type { AuthResponse, LikedArticleRecord, WikiArticle } from './types';

const INITIAL_BATCH = 12;
const REFILL_BATCH = 8;
const REFILL_THRESHOLD = 6;

export default function App() {
  const engineRef = useRef(new RecommendationEngine());

  const [articles, setArticles] = useState<WikiArticle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [likedArticles, setLikedArticles] = useState<Map<number, LikedArticleRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [hintsVisible, setHintsVisible] = useState(true);
  const [likesPanelOpen, setLikesPanelOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [username, setUsername] = useState<string | null>(getUsername());
  const [topInterests, setTopInterests] = useState<string[]>([]);
  const [indicator, setIndicator] = useState<'up' | 'down' | null>(null);

  const isFetchingRef = useRef(false);
  const wheelCooldownRef = useRef(false);
  const touchStartYRef = useRef(0);

  const refreshTopInterests = useCallback(() => {
    setTopInterests(engineRef.current.getTopInterests(8));
  }, []);

  const persist = useCallback(
    (nextLikedArticles: Map<number, LikedArticleRecord>) => {
      saveToLocalStorage(engineRef.current, nextLikedArticles);
      // Best-effort sync to the backend if signed in; failures are non-fatal.
      if (getToken()) {
        interestsApi
          .put({
            interests: engineRef.current.interests,
            likedTitles: engineRef.current.likedTitles,
            seenIds: Array.from(engineRef.current.seenIds).slice(-1000),
            clickedIds: Array.from(engineRef.current.clickedIds).slice(-500),
          })
          .catch(() => {});
      }
      refreshTopInterests();
    },
    [refreshTopInterests],
  );

  const applyEnrichedAttributions = useCallback((batch: WikiArticle[]) => {
    enrichAttributions(batch).then((enriched) => {
      if (enriched.size === 0) return;
      setArticles((prev) => prev.map((a) => (enriched.has(a.id) ? { ...a, attribution: enriched.get(a.id) } : a)));
    });
  }, []);

  const ensureBuffer = useCallback(
    async (current: WikiArticle[], index: number) => {
      if (isFetchingRef.current) return;
      const remaining = current.length - index - 1;
      if (remaining >= REFILL_THRESHOLD) return;

      isFetchingRef.current = true;
      try {
        const more = await loadSmartArticles(engineRef.current, REFILL_BATCH);
        setArticles((prev) => {
          const next = [...prev, ...more];
          applyEnrichedAttributions(more);
          return next;
        });
        saveToLocalStorage(engineRef.current, likedArticles);
      } finally {
        isFetchingRef.current = false;
      }
    },
    [applyEnrichedAttributions, likedArticles],
  );

  // ─── Initial load ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const stored = loadFromLocalStorage();
      if (stored) {
        engineRef.current.interests = stored.engine.interests || {};
        engineRef.current.likedTitles = stored.engine.likedTitles || [];
        stored.seenIds.forEach((id) => engineRef.current.seenIds.add(id));
        stored.clickedIds.forEach((id) => engineRef.current.clickedIds.add(id));
        const map = new Map<number, LikedArticleRecord>();
        stored.likedArticles.forEach((a) => {
          map.set(a.id, a);
          engineRef.current.markSeen(a.id, a.title);
        });
        setLikedArticles(map);
        setLiked(new Set(map.keys()));
      }

      // If already signed in, pull server-side state (merges over local).
      if (getToken()) {
        try {
          const me = await authApi.me();
          setUsername(me.username);
          const [likesRes, interestsRes] = await Promise.all([likesApi.list(), interestsApi.get()]);
          const map = new Map<number, LikedArticleRecord>();
          likesRes.likes.forEach((l) => {
            map.set(l.id, {
              id: l.id,
              title: l.title,
              description: l.description,
              extract: l.extract,
              image: l.image || null,
              url: l.url,
            });
            engineRef.current.markSeen(l.id, l.title);
          });
          engineRef.current.interests = interestsRes.interests;
          engineRef.current.likedTitles = interestsRes.likedTitles;
          interestsRes.seenIds.forEach((id) => engineRef.current.seenIds.add(id));
          interestsRes.clickedIds.forEach((id) => engineRef.current.clickedIds.add(id));
          setLikedArticles(map);
          setLiked(new Set(map.keys()));
        } catch {
          clearSession();
          setUsername(null);
        }
      }

      const batch = await loadSmartArticles(engineRef.current, INITIAL_BATCH);
      if (cancelled) return;
      setArticles(batch);
      setLoading(false);
      applyEnrichedAttributions(batch);
      refreshTopInterests();
    }

    init();

    const hideHints = setTimeout(() => setHintsVisible(false), 4000);
    return () => {
      cancelled = true;
      clearTimeout(hideHints);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Navigation ──────────────────────────────────────────
  const navigate = useCallback(
    (direction: 1 | -1) => {
      if (isTransitioning) return;
      const newIndex = currentIndex + direction;
      if (newIndex < 0 || newIndex >= articles.length) return;

      setIsTransitioning(true);
      setCurrentIndex(newIndex);
      setIndicator(direction > 0 ? 'down' : 'up');
      setTimeout(() => setIndicator(null), 400);

      ensureBuffer(articles, newIndex);
      setTimeout(() => setIsTransitioning(false), 550);
    },
    [articles, currentIndex, ensureBuffer, isTransitioning],
  );

  // ─── Likes ───────────────────────────────────────────────
  const toggleLike = useCallback(
    (article: WikiArticle) => {
      const isLiked = liked.has(article.id);
      const nextLiked = new Set(liked);
      const nextMap = new Map(likedArticles);

      if (isLiked) {
        nextLiked.delete(article.id);
        nextMap.delete(article.id);
        engineRef.current.removeLike(article);
        if (getToken()) likesApi.remove(article.id).catch(() => {});
      } else {
        nextLiked.add(article.id);
        const record: LikedArticleRecord = {
          id: article.id,
          title: article.title,
          description: article.description,
          image: article.image,
          url: article.url,
          extract: article.extract,
        };
        nextMap.set(article.id, record);
        engineRef.current.addLike(article);
        if (getToken()) likesApi.add(record).catch(() => {});
      }

      setLiked(nextLiked);
      setLikedArticles(nextMap);
      persist(nextMap);
    },
    [liked, likedArticles, persist],
  );

  const removeLikedArticle = useCallback(
    (id: number) => {
      const article = likedArticles.get(id);
      if (!article) return;
      const nextLiked = new Set(liked);
      const nextMap = new Map(likedArticles);
      nextLiked.delete(id);
      nextMap.delete(id);
      engineRef.current.removeLike(article);
      if (getToken()) likesApi.remove(id).catch(() => {});
      setLiked(nextLiked);
      setLikedArticles(nextMap);
      persist(nextMap);
    },
    [liked, likedArticles, persist],
  );

  function shareArticle(article: WikiArticle) {
    if (navigator.share) {
      navigator.share({ title: article.title, url: article.url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(article.url).catch(() => {});
    }
  }

  const openArticle = useCallback(
    (article: WikiArticle) => {
      engineRef.current.trackClick(article);
      persist(likedArticles);
      window.open(article.url, '_blank', 'noopener');
    },
    [likedArticles, persist],
  );

  const trackLinkClick = useCallback(
    (article: WikiArticle) => {
      engineRef.current.trackClick(article);
      persist(likedArticles);
    },
    [likedArticles, persist],
  );

  // ─── Navigation ──────────────────────────────────────────

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape' && likesPanelOpen) {
        setLikesPanelOpen(false);
        return;
      }
      if (likesPanelOpen) return;

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        navigate(1);
      }
      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        navigate(-1);
      }
      if (e.key === 'l') {
        const article = articles[currentIndex];
        if (article) toggleLike(article);
      }
    }

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      if (wheelCooldownRef.current) return;
      wheelCooldownRef.current = true;
      if (e.deltaY > 30) navigate(1);
      else if (e.deltaY < -30) navigate(-1);
      setTimeout(() => {
        wheelCooldownRef.current = false;
      }, 600);
    }

    function handleTouchStart(e: TouchEvent) {
      touchStartYRef.current = e.touches[0].clientY;
    }

    function handleTouchEnd(e: TouchEvent) {
      const diff = touchStartYRef.current - e.changedTouches[0].clientY;
      if (Math.abs(diff) > 60) navigate(diff > 0 ? 1 : -1);
    }

    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [articles, currentIndex, likesPanelOpen, navigate, toggleLike]);

  function handleAuthenticated(auth: AuthResponse) {
    setSession(auth);
    setUsername(auth.username);
    setAuthOpen(false);
    // Push current local state up to the freshly-authenticated account.
    interestsApi
      .put({
        interests: engineRef.current.interests,
        likedTitles: engineRef.current.likedTitles,
        seenIds: Array.from(engineRef.current.seenIds).slice(-1000),
        clickedIds: Array.from(engineRef.current.clickedIds).slice(-500),
      })
      .catch(() => {});
    Array.from(likedArticles.values()).forEach((a) => likesApi.add(a).catch(() => {}));
  }

  function handleAccountClick() {
    if (username) {
      clearSession();
      setUsername(null);
    } else {
      setAuthOpen(true);
    }
  }

  return (
    <>
      <Header
        onToggleLikes={() => setLikesPanelOpen((v) => !v)}
        username={username}
        onAccountClick={handleAccountClick}
      />

      <LikesPanel
        open={likesPanelOpen}
        onClose={() => setLikesPanelOpen(false)}
        likedArticles={Array.from(likedArticles.values()).reverse()}
        topInterests={topInterests}
        onRemove={removeLikedArticle}
      />

      <NavHints visible={hintsVisible} />

      <div className={`transition-indicator up${indicator === 'up' ? ' active' : ''}`} />
      <div className={`transition-indicator down${indicator === 'down' ? ' active' : ''}`} />

      <div className="scroll-container">
        <div className="cards-wrapper" style={{ transform: `translateY(-${currentIndex * 100}vh)` }}>
          {articles.map((article, i) => (
            <Card
              key={article.id}
              article={article}
              index={i}
              isLiked={liked.has(article.id)}
              onToggleLike={toggleLike}
              onShare={shareArticle}
              onOpen={openArticle}
              onLinkClick={trackLinkClick}
            />
          ))}
        </div>
      </div>

      <div className="article-counter">{currentIndex + 1}</div>

      {loading && (
        <div className="loader">
          <div className="spinner" />
          <div className="loader-text">Loading articles...</div>
        </div>
      )}

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuthenticated={handleAuthenticated} />}
    </>
  );
}
