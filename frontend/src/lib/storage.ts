import type { LikedArticleRecord, PersistedData } from '../types';
import type { RecommendationEngine } from './recommend';

const STORAGE_KEY = 'wikiscroll_data';

export function saveToLocalStorage(
  engine: RecommendationEngine,
  likedArticles: Map<number, LikedArticleRecord>,
): void {
  try {
    const data: PersistedData = {
      interests: engine.interests,
      likedTitles: engine.likedTitles,
      likedArticles: Array.from(likedArticles.values()),
      seenIds: Array.from(engine.seenIds).slice(-500),
      clickedIds: Array.from(engine.clickedIds).slice(-200),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage can fail (quota, privacy mode, etc.) — non-fatal.
  }
}

export interface LoadResult {
  engine: Partial<Pick<RecommendationEngine, 'interests' | 'likedTitles'>>;
  seenIds: number[];
  clickedIds: number[];
  likedArticles: LikedArticleRecord[];
}

export function loadFromLocalStorage(): LoadResult | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<PersistedData>;
    return {
      engine: {
        interests: data.interests || {},
        likedTitles: data.likedTitles || [],
      },
      seenIds: data.seenIds || [],
      clickedIds: data.clickedIds || [],
      likedArticles: data.likedArticles || [],
    };
  } catch {
    return null;
  }
}
